import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { decrypt } from '../../lib/encryption';
import { env } from '../../config/env';
import { fetchShopifyOrder } from '../../lib/shopify';
import { logger } from '../../lib/logger';
import { reconcileOrderMappingStatus } from '../../services/reconciliation';
import type { ListOrdersQuery } from './order.schemas';

// ─── Shopify → Internal normalization ────────────────────────────

interface ShopifyLineItem {
    id: number; sku?: string; variant_id?: number; title: string;
    quantity: number; price: string; total_discount?: string;
}
interface ShopifyAddress {
    name?: string; phone?: string; address1?: string; address2?: string;
    city?: string; province?: string; zip?: string; country?: string;
}

function normalizeOrder(raw: Record<string, unknown>, tenantId: string, storeId: string) {
    return {
        tenant_id: tenantId,
        channel: 'SHOPIFY',
        store_id: storeId,
        external_order_id: String(raw.id),
        external_order_number: String(raw.order_number ?? raw.name ?? ''),
        financial_status: String(raw.financial_status ?? 'unknown'),
        fulfillment_status: raw.fulfillment_status ? String(raw.fulfillment_status) : null,
        currency: String(raw.currency ?? 'USD'),
        subtotal: new Prisma.Decimal(String(raw.current_subtotal_price ?? raw.subtotal_price ?? '0')),
        shipping: new Prisma.Decimal(extractShipping(raw)),
        discounts: new Prisma.Decimal(String(raw.total_discounts ?? '0')),
        total: new Prisma.Decimal(String(raw.current_total_price ?? raw.total_price ?? '0')),
    };
}

function extractShipping(raw: Record<string, unknown>): string {
    const set = raw.total_shipping_price_set as { shop_money?: { amount?: string } } | undefined;
    if (set?.shop_money?.amount) return set.shop_money.amount;
    return '0';
}

function normalizeItems(raw: Record<string, unknown>, tenantId: string, orderId: string) {
    const items = (raw.line_items ?? []) as ShopifyLineItem[];
    return items.map((li) => ({
        tenant_id: tenantId,
        order_id: orderId,
        external_line_item_id: String(li.id),
        sku: li.sku || null,
        variant_id: li.variant_id ? String(li.variant_id) : null,
        title: li.title,
        qty: li.quantity,
        price: new Prisma.Decimal(li.price),
        discount: new Prisma.Decimal(li.total_discount ?? '0'),
    }));
}

function normalizeAddresses(raw: Record<string, unknown>, tenantId: string, orderId: string) {
    const results: Array<{
        tenant_id: string; order_id: string; type: string;
        name: string | null; phone: string | null;
        address1: string | null; address2: string | null;
        city: string | null; province: string | null;
        zip: string | null; country: string | null;
    }> = [];
    const mapAddr = (addr: ShopifyAddress | undefined, type: string) => {
        if (!addr) return;
        results.push({
            tenant_id: tenantId, order_id: orderId, type,
            name: addr.name ?? null, phone: addr.phone ?? null,
            address1: addr.address1 ?? null, address2: addr.address2 ?? null,
            city: addr.city ?? null, province: addr.province ?? null,
            zip: addr.zip ?? null, country: addr.country ?? null,
        });
    };
    mapAddr(raw.shipping_address as ShopifyAddress | undefined, 'shipping');
    mapAddr(raw.billing_address as ShopifyAddress | undefined, 'billing');
    return results;
}

// ─── Import Order ────────────────────────────────────────────────

export async function importShopifyOrder(params: {
    storeId: string; tenantId: string; externalOrderId: string; sourceWebhookId?: string;
}) {
    const store = await prisma.shopifyStore.findFirst({
        where: { id: params.storeId, tenant_id: params.tenantId },
    });
    if (!store) throw new Error('Store not found');
    const accessToken = decrypt(store.access_token_enc, env.ENCRYPTION_KEY);

    const raw = await fetchShopifyOrder(store.shop_domain, accessToken, params.externalOrderId);
    const normalized = normalizeOrder(raw, params.tenantId, params.storeId);

    // Idempotent upsert
    const existing = await prisma.order.findFirst({
        where: {
            tenant_id: params.tenantId, channel: 'SHOPIFY',
            store_id: params.storeId, external_order_id: params.externalOrderId,
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
    const items = normalizeItems(raw, params.tenantId, order.id);
    if (items.length > 0) {
        await prisma.orderItem.createMany({ data: items });
    }

    // Replace addresses
    await prisma.orderAddress.deleteMany({ where: { order_id: order.id, tenant_id: params.tenantId } });
    const addresses = normalizeAddresses(raw, params.tenantId, order.id);
    if (addresses.length > 0) {
        await prisma.orderAddress.createMany({ data: addresses });
    }

    // Create event
    await prisma.orderEvent.create({
        data: {
            tenant_id: params.tenantId,
            order_id: order.id,
            channel: 'SHOPIFY',
            type: existing ? 'order_updated' : 'order_imported',
            payload_json: { externalOrderId: params.externalOrderId, sourceWebhookId: params.sourceWebhookId },
        },
    });

    // Mark webhook processed
    if (params.sourceWebhookId) {
        await prisma.shopifyWebhook.update({
            where: { id: params.sourceWebhookId },
            data: { status: 'processed', processed_at: new Date() },
        });
    }

    // Reconcile mapping status
    await reconcileOrderMappingStatus(order.id, params.tenantId);

    logger.info('Order imported', { orderId: order.id, external: params.externalOrderId });
    return order;
}

// ─── CRUD ────────────────────────────────────────────────────────

export async function listOrders(tenantId: string, query: ListOrdersQuery) {
    const where: Prisma.OrderWhereInput = { tenant_id: tenantId };
    if (query.status) where.financial_status = query.status;
    if (query.operational_status) where.operational_status = query.operational_status;
    if (query.store_id) where.store_id = query.store_id;
    if (query.from || query.to) {
        where.created_at = {};
        if (query.from) where.created_at.gte = new Date(query.from);
        if (query.to) where.created_at.lte = new Date(query.to);
    }
    const [orders, total] = await Promise.all([
        prisma.order.findMany({
            where, orderBy: { created_at: 'desc' },
            skip: (query.page - 1) * query.page_size, take: query.page_size,
            select: {
                id: true, external_order_number: true, channel: true, store_id: true,
                financial_status: true, fulfillment_status: true, operational_status: true,
                total: true, currency: true, created_at: true,
            },
        }),
        prisma.order.count({ where }),
    ]);
    return { orders, total, page: query.page, pageSize: query.page_size };
}

export async function getOrderDetail(orderId: string, tenantId: string) {
    return prisma.order.findFirst({
        where: { id: orderId, tenant_id: tenantId },
        include: {
            items: true, addresses: true,
            events: { orderBy: { created_at: 'desc' } },
            purchase_orders: { include: { supplier: { select: { name: true } } }, orderBy: { created_at: 'desc' } },
        },
    });
}

export async function getOrderEvents(orderId: string, tenantId: string) {
    return prisma.orderEvent.findMany({
        where: { order_id: orderId, tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
    });
}
