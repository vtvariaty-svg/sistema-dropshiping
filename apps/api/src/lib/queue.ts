import { Queue, QueueOptions } from 'bullmq';
import { logger } from './logger';

function getRedisOpts(): QueueOptions['connection'] | null {
    const url = process.env.REDIS_URL;
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: Number(parsed.port) || 6379,
            password: parsed.password || undefined,
            username: parsed.username || undefined,
            tls: parsed.protocol === 'rediss:' ? {} : undefined,
            maxRetriesPerRequest: null,
        };
    } catch {
        logger.error('Invalid REDIS_URL format');
        return null;
    }
}

export const SHOPIFY_WEBHOOK_QUEUE = 'shopify-webhooks';
export const ORDER_IMPORT_QUEUE = 'order-import';
export const TIKTOK_WEBHOOK_QUEUE = 'tiktok-webhooks';

let webhookQueue: Queue | null = null;
let importQueue: Queue | null = null;
let tiktokWebhookQueue: Queue | null = null;

export function getRedisConnectionOpts() {
    return getRedisOpts();
}

export function getWebhookQueue(): Queue | null {
    const opts = getRedisOpts();
    if (!opts) return null;
    if (!webhookQueue) {
        webhookQueue = new Queue(SHOPIFY_WEBHOOK_QUEUE, { connection: opts });
    }
    return webhookQueue;
}

export function getImportQueue(): Queue | null {
    const opts = getRedisOpts();
    if (!opts) return null;
    if (!importQueue) {
        importQueue = new Queue(ORDER_IMPORT_QUEUE, { connection: opts });
    }
    return importQueue;
}

export function getTiktokWebhookQueue(): Queue | null {
    const opts = getRedisOpts();
    if (!opts) return null;
    if (!tiktokWebhookQueue) {
        tiktokWebhookQueue = new Queue(TIKTOK_WEBHOOK_QUEUE, { connection: opts });
    }
    return tiktokWebhookQueue;
}
