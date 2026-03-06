import { Worker } from 'bullmq';
import { prisma } from '../lib/prisma';
import { getRedisConnectionOpts, SHOPIFY_WEBHOOK_QUEUE } from '../lib/queue';
import { logger } from '../lib/logger';

async function processShopifyWebhook(webhookRecordId: string) {
    const webhook = await prisma.shopifyWebhook.findUnique({ where: { id: webhookRecordId } });
    if (!webhook) {
        logger.warn('Webhook record not found for processing', { webhookRecordId });
        return;
    }
    if (webhook.status === 'processed') {
        logger.info('Webhook already processed, skipping', { webhookRecordId });
        return;
    }

    try {
        const payload = webhook.payload_raw as Record<string, unknown>;
        switch (webhook.topic) {
            case 'orders/create':
                logger.info('Processing orders/create', { webhookRecordId, orderId: payload?.id });
                break;
            case 'orders/updated':
                logger.info('Processing orders/updated', { webhookRecordId, orderId: payload?.id });
                break;
            default:
                logger.info('Unhandled webhook topic', { webhookRecordId, topic: webhook.topic });
        }

        await prisma.shopifyWebhook.update({
            where: { id: webhookRecordId },
            data: { status: 'processed', processed_at: new Date() },
        });
        logger.info('Webhook processed', { webhookRecordId, topic: webhook.topic });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        await prisma.shopifyWebhook.update({
            where: { id: webhookRecordId },
            data: { status: 'failed', error: errorMsg },
        });
        await prisma.deadLetterJob.create({
            data: {
                tenant_id: webhook.tenant_id,
                job_type: 'shopify_webhook',
                payload_json: { webhookRecordId, topic: webhook.topic },
                error: errorMsg,
                attempts: 1,
            },
        });
        logger.error('Webhook processing failed, moved to dead letter', { webhookRecordId, error: errorMsg });
        throw err;
    }
}

export function startWebhookWorker() {
    const connOpts = getRedisConnectionOpts();
    if (!connOpts) {
        logger.warn('Redis not configured — webhook worker not started');
        return null;
    }

    const worker = new Worker(
        SHOPIFY_WEBHOOK_QUEUE,
        async (job) => {
            const { webhookRecordId } = job.data as { webhookRecordId: string };
            await processShopifyWebhook(webhookRecordId);
        },
        {
            connection: connOpts,
            concurrency: 5,
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 5000 },
        },
    );

    worker.on('completed', (job) => {
        logger.info('Worker job completed', { jobId: job.id });
    });
    worker.on('failed', (job, err) => {
        logger.error('Worker job failed', { jobId: job?.id, error: err.message });
    });

    logger.info('Shopify webhook worker started');
    return worker;
}
