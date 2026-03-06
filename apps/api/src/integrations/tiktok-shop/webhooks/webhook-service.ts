import { prisma } from '../../../lib/prisma';
import { getTiktokWebhookQueue } from '../../../lib/queue';
import { logger } from '../../../lib/logger';
import { generateDedupHash } from './webhook-adapter';

/**
 * Stores a TikTok webhook payload and enqueues processing via BullMQ.
 */

export async function storeTikTokWebhookAndEnqueue(params: {
    tenantId: string;
    shopDbId: string | null;
    eventType: string;
    eventId: string | null;
    payload: unknown;
    traceId: string;
}) {
    // Deduplication — check for existing event_id
    const dedupId = params.eventId ?? generateDedupHash(params.eventType, params.payload as Record<string, unknown>);

    const existing = await prisma.tiktokWebhookEntry.findFirst({
        where: {
            tenant_id: params.tenantId,
            event_id: dedupId,
        },
    });
    if (existing) {
        logger.info('Duplicate TikTok webhook skipped', { eventId: dedupId, traceId: params.traceId });
        return existing;
    }

    const record = await prisma.tiktokWebhookEntry.create({
        data: {
            tenant_id: params.tenantId,
            shop_id_ref: params.shopDbId,
            event_type: params.eventType,
            event_id: dedupId,
            payload_raw: params.payload as object,
            status: 'RECEIVED',
        },
    });

    const queue = getTiktokWebhookQueue();
    if (queue) {
        await queue.add('process_tiktok_webhook', { tiktokWebhookId: record.id }, {
            jobId: `tiktok-wh-${record.id}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
        });
        logger.info('TikTok webhook enqueued', {
            webhookId: record.id,
            eventType: params.eventType,
            traceId: params.traceId,
        });
    } else {
        logger.warn('Redis not configured, TikTok webhook stored but not enqueued', {
            webhookId: record.id,
            traceId: params.traceId,
        });
    }

    return record;
}

export async function retryTikTokWebhook(webhookId: string, tenantId: string, traceId: string) {
    const webhook = await prisma.tiktokWebhookEntry.findFirst({
        where: { id: webhookId, tenant_id: tenantId },
    });
    if (!webhook) throw new Error('TikTok webhook not found');
    if (webhook.status === 'PROCESSED') throw new Error('Webhook already processed');

    await prisma.tiktokWebhookEntry.update({
        where: { id: webhookId },
        data: { status: 'RECEIVED', error: null, processed_at: null },
    });

    const queue = getTiktokWebhookQueue();
    if (queue) {
        await queue.add('process_tiktok_webhook', { tiktokWebhookId: webhookId }, {
            jobId: `tiktok-wh-retry-${webhookId}-${Date.now()}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
        });
        logger.info('TikTok webhook retry enqueued', { webhookId, traceId });
    }

    return { retried: true };
}

export async function listTikTokWebhooks(tenantId: string) {
    return prisma.tiktokWebhookEntry.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: 100,
        select: {
            id: true,
            event_type: true,
            event_id: true,
            received_at: true,
            processed_at: true,
            status: true,
            error: true,
        },
    });
}

export async function listTikTokSyncLogs(tenantId: string) {
    return prisma.tiktokSyncLog.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: 100,
        select: {
            id: true,
            sync_type: true,
            status: true,
            error: true,
            created_at: true,
        },
    });
}
