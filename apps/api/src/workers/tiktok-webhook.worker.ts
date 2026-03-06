import { Worker } from 'bullmq';
import { prisma } from '../lib/prisma';
import { getRedisConnectionOpts, getImportQueue, TIKTOK_WEBHOOK_QUEUE } from '../lib/queue';
import { logger } from '../lib/logger';
import { importTikTokOrder } from '../integrations/tiktok-shop/orders/order-import-service';

const ORDER_EVENT_TYPES = [
    'ORDER_STATUS_CHANGE',
    'ORDER_STATUS_CHANGED',
    'order_status_change',
    '1',  // TikTok numeric event type for order creation
];

async function processTikTokWebhook(tiktokWebhookId: string) {
    const webhook = await prisma.tiktokWebhookEntry.findUnique({ where: { id: tiktokWebhookId } });
    if (!webhook) { logger.warn('TikTok webhook not found', { tiktokWebhookId }); return; }
    if (webhook.status === 'PROCESSED') { return; }

    const payload = webhook.payload_raw as Record<string, unknown>;
    const eventData = (payload.data ?? payload) as Record<string, unknown>;

    try {
        if (ORDER_EVENT_TYPES.includes(webhook.event_type)) {
            const orderId = eventData.order_id ? String(eventData.order_id) : null;
            if (!orderId) {
                await prisma.tiktokWebhookEntry.update({
                    where: { id: tiktokWebhookId },
                    data: { status: 'FAILED', error: 'Missing order_id in payload' },
                });
                return;
            }

            // Import directly (synchronous) or enqueue (if Redis is available)
            await importTikTokOrder({
                tiktokShopDbId: webhook.shop_id_ref!,
                tenantId: webhook.tenant_id,
                externalOrderId: orderId,
                sourceWebhookId: webhook.id,
                rawPayload: eventData,
            });

            return;
        }

        // Unhandled event type — mark processed
        await prisma.tiktokWebhookEntry.update({
            where: { id: tiktokWebhookId },
            data: { status: 'PROCESSED', processed_at: new Date() },
        });
        logger.info('TikTok webhook processed (unhandled type)', {
            tiktokWebhookId,
            eventType: webhook.event_type,
        });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        logger.error('TikTok webhook processing failed', { tiktokWebhookId, error: errorMsg });

        await prisma.tiktokWebhookEntry.update({
            where: { id: tiktokWebhookId },
            data: { status: 'FAILED', error: errorMsg },
        }).catch(() => { });

        // Sync log for failure
        await prisma.tiktokSyncLog.create({
            data: {
                tenant_id: webhook.tenant_id,
                shop_id_ref: webhook.shop_id_ref,
                sync_type: 'WEBHOOK_PROCESS',
                status: 'FAILED',
                error: errorMsg,
                payload_json: { tiktokWebhookId },
            },
        }).catch(() => { });

        throw err;
    }
}

export function startTikTokWebhookWorker() {
    const connOpts = getRedisConnectionOpts();
    if (!connOpts) {
        logger.warn('Redis not configured — TikTok webhook worker not started');
        return null;
    }

    const worker = new Worker(
        TIKTOK_WEBHOOK_QUEUE,
        async (job) => {
            const { tiktokWebhookId } = job.data as { tiktokWebhookId: string };
            await processTikTokWebhook(tiktokWebhookId);
        },
        { connection: connOpts, concurrency: 5, removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } },
    );

    worker.on('completed', (job) => logger.info('TikTok webhook job completed', { jobId: job.id }));
    worker.on('failed', (job, err) => logger.error('TikTok webhook job failed', { jobId: job?.id, error: err.message }));

    logger.info('TikTok webhook worker started');
    return worker;
}
