import { prisma } from '../../lib/prisma';
import { decrypt } from '../../lib/encryption';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

const SHOPIFY_API_VERSION = '2024-01';

// ─── Register Tracking ──────────────────────────────────────────

export async function registerTrackingForPurchaseOrder(tenantId: string, poId: string, data: {
    carrier?: string | null; tracking_code: string; tracking_url?: string | null;
}) {
    const po = await prisma.purchaseOrder.findFirst({
        where: { id: poId, tenant_id: tenantId },
        include: { order: true },
    });
    if (!po) throw new Error('Purchase order not found');
    if (!['DISPATCHED', 'SHIPPED'].includes(po.status)) throw new Error(`PO status ${po.status} does not allow tracking`);

    // Upsert: one active tracking per PO
    const existing = await prisma.shipmentTracking.findFirst({
        where: { purchase_order_id: poId, tenant_id: tenantId },
    });

    let tracking;
    if (existing) {
        tracking = await prisma.shipmentTracking.update({
            where: { id: existing.id },
            data: {
                carrier: data.carrier ?? existing.carrier,
                tracking_code: data.tracking_code,
                tracking_url: data.tracking_url ?? existing.tracking_url,
                status: 'REGISTERED',
            },
        });
    } else {
        tracking = await prisma.shipmentTracking.create({
            data: {
                tenant: { connect: { id: tenantId } },
                purchase_order: { connect: { id: poId } },
                carrier: data.carrier ?? null,
                tracking_code: data.tracking_code,
                tracking_url: data.tracking_url ?? null,
                status: 'REGISTERED',
            },
        });
    }

    // Update PO to SHIPPED
    if (po.status !== 'SHIPPED') {
        await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: 'SHIPPED' } });
    }

    // Update order to IN_FULFILLMENT
    if (po.order.operational_status !== 'IN_FULFILLMENT' && po.order.operational_status !== 'FULFILLED') {
        await prisma.order.update({ where: { id: po.order_id }, data: { operational_status: 'IN_FULFILLMENT' } });
    }

    // Create PO event
    await prisma.poEvent.create({
        data: {
            tenant: { connect: { id: tenantId } },
            purchase_order: { connect: { id: poId } },
            type: 'tracking_registered',
            payload_json: { carrier: data.carrier, trackingCode: data.tracking_code, trackingId: tracking.id },
        },
    });

    logger.info('Tracking registered', { poId, tenantId, trackingId: tracking.id });
    return tracking;
}

// ─── Get Tracking ────────────────────────────────────────────────

export async function getTrackingForPO(tenantId: string, poId: string) {
    return prisma.shipmentTracking.findFirst({
        where: { purchase_order_id: poId, tenant_id: tenantId },
    });
}

// ─── Push Shopify Fulfillment ────────────────────────────────────

export async function syncShopifyFulfillment(tenantId: string, orderId: string, poId?: string) {
    const order = await prisma.order.findFirst({
        where: { id: orderId, tenant_id: tenantId },
        include: {
            store: true,
            items: true,
            purchase_orders: {
                where: poId ? { id: poId } : { status: 'SHIPPED' },
                include: { tracking: true, items: { include: { order_item: true } } },
            },
        },
    });

    if (!order) throw new Error('Order not found');
    if (!order.store) throw new Error('No connected Shopify store');

    const accessToken = decrypt(order.store.access_token_enc, env.ENCRYPTION_KEY);
    const shop = order.store.shop_domain;

    // Get previous attempt count
    const prevAttempts = await prisma.fulfillmentSyncLog.count({
        where: { order_id: orderId, tenant_id: tenantId },
    });

    const results = [];

    for (const po of order.purchase_orders) {
        const trackingRecord = po.tracking[0];
        if (!trackingRecord) continue;

        // Get line item IDs for this PO
        const lineItemIds = po.items
            .map((pi) => pi.order_item.external_line_item_id)
            .filter(Boolean);

        try {
            // Shopify fulfillment API
            const fulfillmentData: Record<string, unknown> = {
                fulfillment: {
                    tracking_number: trackingRecord.tracking_code,
                    tracking_urls: trackingRecord.tracking_url ? [trackingRecord.tracking_url] : [],
                    tracking_company: trackingRecord.carrier ?? '',
                    notify_customer: true,
                    line_items: lineItemIds.map((id) => ({ id: Number(id) })),
                },
            };

            const res = await fetch(
                `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders/${order.external_order_id}/fulfillments.json`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shopify-Access-Token': accessToken,
                    },
                    body: JSON.stringify(fulfillmentData),
                }
            );

            const body = await res.json() as Record<string, unknown>;

            if (res.ok) {
                // Success
                await prisma.shipmentTracking.update({
                    where: { id: trackingRecord.id },
                    data: { status: 'SYNCED' },
                });
                await prisma.fulfillmentSyncLog.create({
                    data: {
                        tenant: { connect: { id: tenantId } },
                        order: { connect: { id: orderId } },
                        purchase_order: { connect: { id: po.id } },
                        attempt: prevAttempts + 1,
                        status: 'SUCCESS',
                        payload_json: { response: body },
                    },
                });
                results.push({ poId: po.id, status: 'SUCCESS' });
                logger.info('Shopify fulfillment synced', { orderId, poId: po.id, tenantId });
            } else {
                // Failure
                const errorMsg = JSON.stringify(body);
                await prisma.shipmentTracking.update({
                    where: { id: trackingRecord.id },
                    data: { status: 'FAILED' },
                });
                await prisma.fulfillmentSyncLog.create({
                    data: {
                        tenant: { connect: { id: tenantId } },
                        order: { connect: { id: orderId } },
                        purchase_order: { connect: { id: po.id } },
                        attempt: prevAttempts + 1,
                        status: 'FAILED',
                        error: errorMsg,
                        payload_json: { response: body },
                    },
                });
                results.push({ poId: po.id, status: 'FAILED', error: errorMsg });
                logger.error('Shopify fulfillment sync failed', { orderId, poId: po.id, tenantId, error: errorMsg });
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            await prisma.fulfillmentSyncLog.create({
                data: {
                    tenant: { connect: { id: tenantId } },
                    order: { connect: { id: orderId } },
                    purchase_order: { connect: { id: po.id } },
                    attempt: prevAttempts + 1,
                    status: 'FAILED',
                    error: errorMsg,
                },
            });
            results.push({ poId: po.id, status: 'FAILED', error: errorMsg });
            logger.error('Shopify fulfillment sync exception', { orderId, poId: po.id, tenantId, error: errorMsg });
        }
    }

    // Recompute order status
    await recomputeOrderStatusAfterTracking(tenantId, orderId);
    return results;
}

// ─── Recompute Order Status ──────────────────────────────────────

export async function recomputeOrderStatusAfterTracking(tenantId: string, orderId: string) {
    const order = await prisma.order.findFirst({
        where: { id: orderId, tenant_id: tenantId },
        include: {
            purchase_orders: {
                where: { status: { not: 'CANCELLED' } },
                include: { tracking: true },
            },
        },
    });
    if (!order) return;

    const activePOs = order.purchase_orders;
    if (activePOs.length === 0) return;

    const allSynced = activePOs.every((po) =>
        po.tracking.length > 0 && po.tracking.every((t) => t.status === 'SYNCED')
    );

    const anyTracked = activePOs.some((po) => po.tracking.length > 0);

    let newStatus = order.operational_status;
    if (allSynced) {
        newStatus = 'FULFILLED';
    } else if (anyTracked) {
        newStatus = 'IN_FULFILLMENT';
    }

    if (newStatus !== order.operational_status) {
        await prisma.order.update({ where: { id: orderId }, data: { operational_status: newStatus } });
        logger.info('Order status updated after tracking', { orderId, tenantId, status: newStatus });
    }
}

// ─── Fulfillment Sync Logs ───────────────────────────────────────

export async function getOrderFulfillmentLogs(tenantId: string, orderId: string) {
    return prisma.fulfillmentSyncLog.findMany({
        where: { order_id: orderId, tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
    });
}

export async function getPOFulfillmentLogs(tenantId: string, poId: string) {
    return prisma.fulfillmentSyncLog.findMany({
        where: { purchase_order_id: poId, tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
    });
}
