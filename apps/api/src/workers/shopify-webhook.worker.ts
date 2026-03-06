import { Worker } from 'bullmq';
import { prisma } from '../lib/prisma';
import { getRedisConnectionOpts, getImportQueue, SHOPIFY_WEBHOOK_QUEUE } from '../lib/queue';
import { logger } from '../lib/logger';
import type { ImportOrderPayload } from './import-order.worker';

async function processShopifyWebhook(webhookRecordId: string) {
    const webhook = await prisma.shopifyWebhook.findUnique({ where: { id: webhookRecordId } });
    if (!webhook) { logger.warn('Webhook not found', { webhookRecordId }); return; }
    if (webhook.status === 'processed') { return; }

    const payload = webhook.payload_raw as Record<string, unknown>;

    if (webhook.topic === 'orders/create' || webhook.topic === 'orders/updated') {
        const orderId = payload.id ? String(payload.id) : null;
        if (!orderId) {
            await prisma.shopifyWebhook.update({
                where: { id: webhookRecordId },
                data: { status: 'failed', error: 'Missing order id in payload' },
            });
            return;
        }

        const queue = getImportQueue();
        if (queue) {
            const jobPayload: ImportOrderPayload = {
                storeId: webhook.store_id,
                tenantId: webhook.tenant_id,
                externalOrderId: orderId,
                sourceWebhookId: webhook.id,
            };
            // Dedup by jobId
            const jobId = `import-${webhook.tenant_id}-${orderId}`;
            await queue.add('import_shopify_order', jobPayload, {
                jobId,
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
            });
            logger.info('Order import enqueued', { webhookRecordId, orderId, jobId });
        } else {
            // No Redis — mark pending, can't process
            logger.warn('Redis not configured, cannot enqueue import', { webhookRecordId });
        }
        return;
    }

    // Unhandled topic — just mark processed
    await prisma.shopifyWebhook.update({
        where: { id: webhookRecordId },
        data: { status: 'processed', processed_at: new Date() },
    });
    logger.info('Webhook processed (unhandled topic)', { webhookRecordId, topic: webhook.topic });
}

export function startWebhookWorker() {
    const connOpts = getRedisConnectionOpts();
    if (!connOpts) { logger.warn('Redis not configured — webhook worker not started'); return null; }

    const worker = new Worker(
        SHOPIFY_WEBHOOK_QUEUE,
        async (job) => {
            const { webhookRecordId } = job.data as { webhookRecordId: string };
            await processShopifyWebhook(webhookRecordId);
        },
        { connection: connOpts, concurrency: 5, removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } },
    );

    worker.on('completed', (job) => logger.info('Webhook job completed', { jobId: job.id }));
    worker.on('failed', (job, err) => logger.error('Webhook job failed', { jobId: job?.id, error: err.message }));

    logger.info('Shopify webhook worker started');
    return worker;
}
