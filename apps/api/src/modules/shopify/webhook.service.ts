import { prisma } from '../../lib/prisma';
import { getWebhookQueue } from '../../lib/queue';
import { logger } from '../../lib/logger';

export async function storeWebhookAndEnqueue(params: {
    tenantId: string;
    storeId: string;
    topic: string;
    webhookId: string;
    payload: unknown;
    traceId: string;
}) {
    const record = await prisma.shopifyWebhook.create({
        data: {
            tenant_id: params.tenantId,
            store_id: params.storeId,
            topic: params.topic,
            webhook_id: params.webhookId,
            payload_raw: params.payload as object,
            status: 'pending',
        },
    });

    const queue = getWebhookQueue();
    if (queue) {
        await queue.add('process_shopify_webhook', { webhookRecordId: record.id }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
        });
        logger.info('Webhook enqueued', { webhookId: record.id, topic: params.topic, traceId: params.traceId });
    } else {
        logger.warn('Redis not configured, webhook stored but not enqueued', { webhookId: record.id, traceId: params.traceId });
    }

    return record;
}

export async function retryWebhook(webhookId: string, tenantId: string, traceId: string) {
    const webhook = await prisma.shopifyWebhook.findFirst({
        where: { id: webhookId, tenant_id: tenantId },
    });
    if (!webhook) throw new Error('Webhook not found');
    if (webhook.status === 'processed') throw new Error('Webhook already processed');

    await prisma.shopifyWebhook.update({
        where: { id: webhookId },
        data: { status: 'pending', error: null, processed_at: null },
    });

    const queue = getWebhookQueue();
    if (queue) {
        await queue.add('process_shopify_webhook', { webhookRecordId: webhookId }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
        });
        logger.info('Webhook retry enqueued', { webhookId, traceId });
    }

    return { retried: true };
}
