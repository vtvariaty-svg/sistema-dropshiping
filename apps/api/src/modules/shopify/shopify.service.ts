import { prisma } from '../../lib/prisma';
import { encrypt, decrypt } from '../../lib/encryption';
import { env } from '../../config/env';
import { registerWebhookWithShopify, WEBHOOK_TOPICS } from '../../lib/shopify';
import { logger } from '../../lib/logger';

export async function createStore(tenantId: string, shopDomain: string, accessToken: string, scopes: string) {
    const accessTokenEnc = encrypt(accessToken, env.ENCRYPTION_KEY);
    return prisma.shopifyStore.upsert({
        where: { tenant_id_shop_domain: { tenant_id: tenantId, shop_domain: shopDomain } },
        update: { access_token_enc: accessTokenEnc, scopes, status: 'active' },
        create: { tenant_id: tenantId, shop_domain: shopDomain, access_token_enc: accessTokenEnc, scopes, status: 'active' },
    });
}

export async function listStores(tenantId: string) {
    return prisma.shopifyStore.findMany({
        where: { tenant_id: tenantId },
        select: { id: true, shop_domain: true, scopes: true, status: true, created_at: true, updated_at: true },
        orderBy: { created_at: 'desc' },
    });
}

export async function getStoreWithToken(storeId: string, tenantId: string) {
    const store = await prisma.shopifyStore.findFirst({ where: { id: storeId, tenant_id: tenantId } });
    if (!store) return null;
    return { ...store, accessToken: decrypt(store.access_token_enc, env.ENCRYPTION_KEY) };
}

export async function registerWebhooksForStore(storeId: string, tenantId: string, traceId: string) {
    const store = await getStoreWithToken(storeId, tenantId);
    if (!store) throw new Error('Store not found');
    const webhookBaseUrl = `${env.SHOPIFY_APP_URL}/webhooks/shopify/${store.id}`;
    const results: Array<{ topic: string; success: boolean; error?: string }> = [];
    for (const topic of WEBHOOK_TOPICS) {
        try {
            await registerWebhookWithShopify(store.shop_domain, store.accessToken, topic, webhookBaseUrl);
            results.push({ topic, success: true });
            logger.info('Webhook registered', { traceId, tenantId, storeId, topic });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            results.push({ topic, success: false, error: msg });
            logger.error('Webhook registration failed', { traceId, tenantId, storeId, topic, error: msg });
        }
    }
    return results;
}

export async function listWebhooks(tenantId: string, limit = 50) {
    return prisma.shopifyWebhook.findMany({
        where: { tenant_id: tenantId },
        select: { id: true, topic: true, webhook_id: true, received_at: true, status: true, error: true, store_id: true },
        orderBy: { received_at: 'desc' },
        take: limit,
    });
}

export async function getStoreByIdUnsafe(storeId: string) {
    return prisma.shopifyStore.findUnique({ where: { id: storeId } });
}
