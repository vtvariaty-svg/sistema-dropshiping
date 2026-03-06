import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export async function resolveSupplierMappingForItem(params: {
    tenantId: string; channel: string; storeId: string | null;
    shopifySku: string | null; shopifyVariantId: string | null;
}) {
    // Priority 1: variant_id match
    if (params.shopifyVariantId) {
        const mapping = await prisma.skuMapping.findFirst({
            where: {
                tenant_id: params.tenantId, channel: params.channel, store_id: params.storeId,
                shopify_variant_id: params.shopifyVariantId, active: true,
            },
            include: { supplier: true, supplier_product: true },
        });
        if (mapping) return mapping;
    }
    // Priority 2: sku match
    if (params.shopifySku) {
        const mapping = await prisma.skuMapping.findFirst({
            where: {
                tenant_id: params.tenantId, channel: params.channel, store_id: params.storeId,
                shopify_sku: params.shopifySku, active: true,
            },
            include: { supplier: true, supplier_product: true },
        });
        if (mapping) return mapping;
    }
    return null;
}

export async function reconcileOrderMappingStatus(orderId: string, tenantId: string) {
    const order = await prisma.order.findFirst({
        where: { id: orderId, tenant_id: tenantId },
        include: { items: true },
    });
    if (!order) return null;
    // Don't downgrade orders that already have POs
    if (order.operational_status === 'PO_CREATED' || order.operational_status === 'FULFILLED') return order.operational_status;

    let allMapped = true;
    for (const item of order.items) {
        const mapping = await resolveSupplierMappingForItem({
            tenantId, channel: order.channel, storeId: order.store_id,
            shopifySku: item.sku, shopifyVariantId: item.variant_id,
        });
        if (!mapping) { allMapped = false; break; }
    }

    const newStatus = order.items.length === 0 ? 'NEW'
        : allMapped ? 'READY_FOR_PO' : 'NEEDS_MAPPING';

    if (order.operational_status !== newStatus) {
        await prisma.order.update({ where: { id: orderId }, data: { operational_status: newStatus } });
        logger.info('Order mapping reconciled', { orderId, tenantId, status: newStatus });
    }
    return newStatus;
}

export async function reconcileAllOrdersForTenant(tenantId: string) {
    const orders = await prisma.order.findMany({
        where: { tenant_id: tenantId, operational_status: { in: ['NEW', 'NEEDS_MAPPING', 'READY_FOR_PO'] } },
        select: { id: true },
    });
    for (const order of orders) {
        await reconcileOrderMappingStatus(order.id, tenantId);
    }
}
