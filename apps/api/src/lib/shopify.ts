import crypto from 'node:crypto';
import { logger } from './logger';

const SHOPIFY_SCOPES = 'read_orders,write_orders,write_fulfillments,read_products,write_products,read_shipping';
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

// ─── MODULE 10: Product Sync ─────────────────────────────────────

export interface ShopifyProductInput {
    title: string;
    body_html: string;
    vendor?: string;
    product_type?: string;
    tags?: string;
    variants: Array<{
        price: string;
        sku?: string;
        inventory_management?: string;
        inventory_quantity?: number;
        option1?: string;
        compare_at_price?: string;
    }>;
    images?: Array<{ src: string }>;
}

export async function createShopifyProduct(
    shop: string, accessToken: string, product: ShopifyProductInput,
): Promise<{ id: number; title: string; handle: string; variants: Array<{ id: number; sku: string }> }> {
    const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ product }),
    });
    const data = await res.json() as { product?: Record<string, unknown>; errors?: unknown };
    if (!res.ok || !data.product) {
        logger.error('Shopify product creation failed', { shop, errors: data.errors });
        throw new Error(`Shopify product creation failed: ${JSON.stringify(data.errors)}`);
    }
    const p = data.product;
    return {
        id: p.id as number,
        title: p.title as string,
        handle: p.handle as string,
        variants: (p.variants as Array<{ id: number; sku: string }>) ?? [],
    };
}

export async function updateShopifyProduct(
    shop: string, accessToken: string, productId: string, product: Partial<ShopifyProductInput>,
): Promise<void> {
    const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}.json`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ product }),
    });
    if (!res.ok) {
        const body = await res.text();
        logger.error('Shopify product update failed', { shop, productId, body });
        throw new Error(`Shopify product update failed: ${res.status}`);
    }
}

export async function deleteShopifyProduct(
    shop: string, accessToken: string, productId: string,
): Promise<void> {
    const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}.json`, {
        method: 'DELETE',
        headers: { 'X-Shopify-Access-Token': accessToken },
    });
    if (!res.ok) {
        logger.error('Shopify product delete failed', { shop, productId, status: res.status });
        throw new Error(`Shopify product delete failed: ${res.status}`);
    }
}
