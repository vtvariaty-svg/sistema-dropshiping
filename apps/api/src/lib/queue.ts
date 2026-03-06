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

let webhookQueue: Queue | null = null;

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
