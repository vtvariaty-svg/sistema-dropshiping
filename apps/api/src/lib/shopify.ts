import crypto from 'node:crypto';
import { logger } from './logger';

const SHOPIFY_SCOPES = 'read_orders,write_fulfillments,read_products';
const SHOPIFY_API_VERSION = '2024-01';

export function buildOAuthUrl(shop: string, apiKey: string, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
        client_id: apiKey,
        scope: SHOPIFY_SCOPES,
        redirect_uri: redirectUri,
        state,
    });
    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
    shop: string, code: string, apiKey: string, apiSecret: string,
): Promise<{ accessToken: string; scope: string }> {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code }),
    });
    if (!res.ok) {
        const body = await res.text();
        logger.error('Shopify token exchange failed', { shop, status: res.status, body });
        throw new Error(`Shopify token exchange failed: ${res.status}`);
    }
    const data = await res.json() as { access_token: string; scope: string };
    return { accessToken: data.access_token, scope: data.scope };
}

export async function registerWebhookWithShopify(
    shop: string, accessToken: string, topic: string, address: string,
): Promise<{ id: number; topic: string }> {
    const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ webhook: { topic, address, format: 'json' } }),
    });
    const data = await res.json() as { webhook?: { id: number; topic: string }; errors?: unknown };
    if (!res.ok || !data.webhook) {
        logger.error('Shopify webhook registration failed', { shop, topic, errors: data.errors });
        throw new Error(`Webhook registration failed for ${topic}`);
    }
    return { id: data.webhook.id, topic: data.webhook.topic };
}

export function verifyWebhookHmac(rawBody: Buffer, hmacHeader: string, secret: string): boolean {
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
    try {
        return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
    } catch {
        return false;
    }
}

export function verifyOAuthHmac(query: Record<string, string>, secret: string): boolean {
    const { hmac, signature, ...params } = query;
    const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
    const computed = crypto.createHmac('sha256', secret).update(sorted).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hmac, 'hex'));
    } catch {
        return false;
    }
}

export const WEBHOOK_TOPICS = ['orders/create', 'orders/updated'] as const;

export async function fetchShopifyOrder(shop: string, accessToken: string, orderId: string): Promise<Record<string, unknown>> {
    const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders/${orderId}.json`, {
        headers: { 'X-Shopify-Access-Token': accessToken },
    });
    if (!res.ok) {
        const body = await res.text();
        logger.error('Shopify order fetch failed', { shop, orderId, status: res.status, body });
        throw new Error(`Shopify order fetch failed: ${res.status}`);
    }
    const data = await res.json() as { order: Record<string, unknown> };
    return data.order;
}
