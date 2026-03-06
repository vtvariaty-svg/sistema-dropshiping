import crypto from 'node:crypto';
import { env } from '../../../config/env';
import { logger } from '../../../lib/logger';

/**
 * TikTok Webhook Adapter — isolates signature validation and payload parsing.
 */

export function validateWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    const secret = env.TIKTOK_SHOP_WEBHOOK_SECRET;
    if (!secret) {
        logger.warn('TIKTOK_SHOP_WEBHOOK_SECRET not configured, skipping signature validation');
        return true; // Allow in non-strict mode when secret absent
    }
    if (!signature) return false;

    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'));
}

export interface ParsedTikTokWebhookEvent {
    type: string;
    eventId: string | null;
    shopId: string | null;
    data: Record<string, unknown>;
    timestamp: number | null;
}

export function parseWebhookPayload(body: Record<string, unknown>): ParsedTikTokWebhookEvent {
    // TikTok webhook format: { type, shop_id, data, timestamp, event_id }
    return {
        type: String(body.type ?? 'unknown'),
        eventId: body.event_id ? String(body.event_id) : null,
        shopId: body.shop_id ? String(body.shop_id) : null,
        data: (body.data ?? body) as Record<string, unknown>,
        timestamp: body.timestamp ? Number(body.timestamp) : null,
    };
}

/**
 * Generate a deterministic hash for deduplication when event_id is unavailable.
 */
export function generateDedupHash(eventType: string, payload: Record<string, unknown>): string {
    const content = eventType + JSON.stringify(payload);
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
}
