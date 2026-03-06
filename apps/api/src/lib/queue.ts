import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from './logger';

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis | null {
    if (!process.env.REDIS_URL) {
        return null;
    }
    if (!connection) {
        connection = new IORedis(process.env.REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            lazyConnect: true,
        });
        connection.on('error', (err) => {
            logger.error('Redis connection error', { error: err.message });
        });
        connection.connect().catch((err) => {
            logger.error('Redis connect failed', { error: err.message });
        });
    }
    return connection;
}

export const SHOPIFY_WEBHOOK_QUEUE = 'shopify-webhooks';

let webhookQueue: Queue | null = null;

export function getWebhookQueue(): Queue | null {
    const conn = getRedisConnection();
    if (!conn) return null;
    if (!webhookQueue) {
        webhookQueue = new Queue(SHOPIFY_WEBHOOK_QUEUE, { connection: conn });
    }
    return webhookQueue;
}
