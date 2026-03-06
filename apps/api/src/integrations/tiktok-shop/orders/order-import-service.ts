import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';
import { decrypt } from '../../../lib/encryption';
import { env } from '../../../config/env';
import { fetchTikTokOrder } from '../client/tiktok-api-client';
import { normalizeTikTokOrder, normalizeTikTokItems, normalizeTikTokAddresses } from '../adapters/order-normalizer';
import { reconcileOrderMappingStatus } from '../../../services/reconciliation';

/**
 * TikTokOrderImportService — imports TikTok Shop orders into the internal pipeline.
 * Mirrors importShopifyOrder from modules/orders/order.service.ts.
 */

export async function importTikTokOrder(params: {
    tiktokShopDbId: string;
    tenantId: string;
    externalOrderId: string;
    sourceWebhookId?: string;
    rawPayload?: Record<string, unknown>;
}) {
    const shop = await prisma.tiktokShop.findFirst({
        where: { id: params.tiktokShopDbId, tenant_id: params.tenantId },
    });
    if (!shop) throw new Error('TikTok shop not found');

    // Use raw payload if available (from webhook), otherwise fetch from API
    let raw: Record<string, unknown>;
    if (params.rawPayload) {
        raw = params.rawPayload;
    } else {
        const accessToken = decrypt(shop.access_token_enc, env.ENCRYPTION_KEY);
        raw = await fetchTikTokOrder(accessToken, params.externalOrderId);
    }

    const normalized = normalizeTikTokOrder(raw, params.tenantId, params.tiktokShopDbId);

    // Idempotent upsert
    const existing = await prisma.order.findFirst({
        where: {
            tenant_id: params.tenantId,
            channel: 'TIKTOK_SHOP',
            tiktok_shop_id: params.tiktokShopDbId,
            external_order_id: params.externalOrderId,
        },
    });

    let order;
    if (existing) {
        order = await prisma.order.update({ where: { id: existing.id }, data: normalized });
    } else {
        order = await prisma.order.create({ data: normalized });
    }

    // Replace items
    await prisma.orderItem.deleteMany({ where: { order_id: order.id, tenant_id: params.tenantId } });
    const items = normalizeTikTokItems(raw, params.tenantId, order.id);
    if (items.length > 0) {
        await prisma.orderItem.createMany({ data: items });
    }

    // Replace addresses
    await prisma.orderAddress.deleteMany({ where: { order_id: order.id, tenant_id: params.tenantId } });
    const addresses = normalizeTikTokAddresses(raw, params.tenantId, order.id);
    if (addresses.length > 0) {
        await prisma.orderAddress.createMany({ data: addresses });
    }

    // Create event
    await prisma.orderEvent.create({
        data: {
            tenant_id: params.tenantId,
            order_id: order.id,
            channel: 'TIKTOK_SHOP',
            type: existing ? 'order_updated' : 'order_imported',
            payload_json: {
                externalOrderId: params.externalOrderId,
                sourceWebhookId: params.sourceWebhookId,
                source: 'tiktok_shop',
            },
        },
    });

    // Mark webhook processed
    if (params.sourceWebhookId) {
        await prisma.tiktokWebhookEntry.update({
            where: { id: params.sourceWebhookId },
            data: { status: 'PROCESSED', processed_at: new Date() },
        });
    }

    // Reconcile mapping status
    await reconcileOrderMappingStatus(order.id, params.tenantId);

    // Sync log
    await prisma.tiktokSyncLog.create({
        data: {
            tenant_id: params.tenantId,
            shop_id_ref: params.tiktokShopDbId,
            sync_type: 'ORDER_IMPORT',
            status: 'SUCCESS',
            payload_json: { orderId: order.id, externalOrderId: params.externalOrderId },
        },
    });

    logger.info('TikTok order imported', {
        orderId: order.id,
        externalOrderId: params.externalOrderId,
        tenantId: params.tenantId,
    });

    return order;
}
