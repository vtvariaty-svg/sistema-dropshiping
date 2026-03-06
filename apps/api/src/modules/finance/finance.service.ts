import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

// ─── Fee Profile CRUD ────────────────────────────────────────────

export async function listFeeProfiles(tenantId: string) {
    return prisma.feeProfile.findMany({ where: { tenant_id: tenantId }, orderBy: { created_at: 'desc' } });
}

export async function createFeeProfile(tenantId: string, data: {
    channel: string; fee_percent: number; payment_fee_percent: number; fixed_fee: number; active?: boolean;
}) {
    // If active, deactivate others for same channel
    if (data.active !== false) {
        await prisma.feeProfile.updateMany({
            where: { tenant_id: tenantId, channel: data.channel, active: true },
            data: { active: false },
        });
    }
    return prisma.feeProfile.create({
        data: {
            tenant: { connect: { id: tenantId } },
            channel: data.channel,
            fee_percent: new Prisma.Decimal(data.fee_percent),
            payment_fee_percent: new Prisma.Decimal(data.payment_fee_percent),
            fixed_fee: new Prisma.Decimal(data.fixed_fee),
            active: data.active !== false,
        },
    });
}

export async function updateFeeProfile(tenantId: string, id: string, data: {
    channel?: string; fee_percent?: number; payment_fee_percent?: number; fixed_fee?: number; active?: boolean;
}) {
    const existing = await prisma.feeProfile.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) throw new Error('Fee profile not found');
    // If activating, deactivate others
    if (data.active === true) {
        await prisma.feeProfile.updateMany({
            where: { tenant_id: tenantId, channel: data.channel ?? existing.channel, active: true, id: { not: id } },
            data: { active: false },
        });
    }
    const updateData: Record<string, unknown> = {};
    if (data.channel !== undefined) updateData.channel = data.channel;
    if (data.fee_percent !== undefined) updateData.fee_percent = new Prisma.Decimal(data.fee_percent);
    if (data.payment_fee_percent !== undefined) updateData.payment_fee_percent = new Prisma.Decimal(data.payment_fee_percent);
    if (data.fixed_fee !== undefined) updateData.fixed_fee = new Prisma.Decimal(data.fixed_fee);
    if (data.active !== undefined) updateData.active = data.active;
    return prisma.feeProfile.update({ where: { id }, data: updateData });
}

export async function deleteFeeProfile(tenantId: string, id: string) {
    const existing = await prisma.feeProfile.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) throw new Error('Fee profile not found');
    return prisma.feeProfile.delete({ where: { id } });
}

// ─── Shipping Profile CRUD ───────────────────────────────────────

export async function listShippingProfiles(tenantId: string) {
    return prisma.shippingProfile.findMany({ where: { tenant_id: tenantId }, orderBy: { created_at: 'desc' } });
}

export async function createShippingProfile(tenantId: string, data: {
    name: string; rule_type: string; avg_shipping_cost: number; active?: boolean; rule_json?: unknown;
}) {
    if (data.active !== false) {
        await prisma.shippingProfile.updateMany({
            where: { tenant_id: tenantId, active: true },
            data: { active: false },
        });
    }
    return prisma.shippingProfile.create({
        data: {
            tenant: { connect: { id: tenantId } },
            name: data.name,
            rule_type: data.rule_type,
            avg_shipping_cost: new Prisma.Decimal(data.avg_shipping_cost),
            active: data.active !== false,
            rule_json: data.rule_json ? JSON.parse(JSON.stringify(data.rule_json)) : undefined,
        },
    });
}

export async function updateShippingProfile(tenantId: string, id: string, data: {
    name?: string; rule_type?: string; avg_shipping_cost?: number; active?: boolean; rule_json?: unknown;
}) {
    const existing = await prisma.shippingProfile.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) throw new Error('Shipping profile not found');
    if (data.active === true) {
        await prisma.shippingProfile.updateMany({
            where: { tenant_id: tenantId, active: true, id: { not: id } },
            data: { active: false },
        });
    }
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.rule_type !== undefined) updateData.rule_type = data.rule_type;
    if (data.avg_shipping_cost !== undefined) updateData.avg_shipping_cost = new Prisma.Decimal(data.avg_shipping_cost);
    if (data.active !== undefined) updateData.active = data.active;
    if (data.rule_json !== undefined) updateData.rule_json = JSON.parse(JSON.stringify(data.rule_json));
    return prisma.shippingProfile.update({ where: { id }, data: updateData });
}

export async function deleteShippingProfile(tenantId: string, id: string) {
    const existing = await prisma.shippingProfile.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) throw new Error('Shipping profile not found');
    return prisma.shippingProfile.delete({ where: { id } });
}

// ─── Profit Calculation ──────────────────────────────────────────

export async function getActiveFeeProfileForChannel(tenantId: string, channel: string) {
    return prisma.feeProfile.findFirst({ where: { tenant_id: tenantId, channel, active: true } });
}

export async function getActiveShippingProfile(tenantId: string) {
    return prisma.shippingProfile.findFirst({ where: { tenant_id: tenantId, active: true } });
}

export async function computeOrderProfitSnapshot(tenantId: string, orderId: string) {
    const order = await prisma.order.findFirst({
        where: { id: orderId, tenant_id: tenantId },
        include: {
            items: true,
            purchase_orders: {
                where: { status: { not: 'CANCELLED' } },
                include: { items: true },
            },
        },
    });
    if (!order) throw new Error('Order not found');

    const revenue = Number(order.total);

    // COGS: prefer PO items, fallback to mapped supplier products
    let cogs = 0;
    if (order.purchase_orders.length > 0) {
        for (const po of order.purchase_orders) {
            cogs += po.items.reduce((sum: number, pi: { unit_cost: Prisma.Decimal; qty: number }) => sum + Number(pi.unit_cost) * pi.qty, 0);
        }
    } else {
        // Fallback: try supplier product costs via mappings
        for (const item of order.items) {
            const mapping = await prisma.skuMapping.findFirst({
                where: {
                    tenant_id: tenantId, active: true,
                    OR: [
                        { shopify_variant_id: item.variant_id ?? undefined },
                        { shopify_sku: item.sku ?? undefined },
                    ].filter((c) => Object.values(c).some(Boolean)),
                },
                include: { supplier_product: true },
            });
            if (mapping) {
                cogs += Number(mapping.supplier_product.cost) * item.qty;
            }
        }
    }

    // Fees
    const feeProfile = await getActiveFeeProfileForChannel(tenantId, order.channel);
    let fees = 0;
    if (feeProfile) {
        const channelFee = revenue * Number(feeProfile.fee_percent) / 100;
        const paymentFee = revenue * Number(feeProfile.payment_fee_percent) / 100;
        fees = channelFee + paymentFee + Number(feeProfile.fixed_fee);
    } else {
        logger.warn('No active fee profile', { tenantId, channel: order.channel, orderId });
    }

    // Shipping
    const shippingProfile = await getActiveShippingProfile(tenantId);
    let shippingCost = 0;
    if (shippingProfile) {
        shippingCost = Number(shippingProfile.avg_shipping_cost);
    } else {
        logger.warn('No active shipping profile', { tenantId, orderId });
    }

    const adsCost = 0; // MVP: default 0
    const netProfit = revenue - cogs - fees - shippingCost - adsCost;
    const marginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
        revenue: Number(revenue.toFixed(2)),
        cogs: Number(cogs.toFixed(2)),
        fees: Number(fees.toFixed(2)),
        shipping: Number(shippingCost.toFixed(2)),
        ads_cost: Number(adsCost.toFixed(2)),
        net_profit: Number(netProfit.toFixed(2)),
        margin_percent: Number(marginPercent.toFixed(4)),
    };
}

export async function recalculateOrderProfit(tenantId: string, orderId: string) {
    const snapshot = await computeOrderProfitSnapshot(tenantId, orderId);

    const result = await prisma.orderProfit.upsert({
        where: { tenant_id_order_id: { tenant_id: tenantId, order_id: orderId } },
        create: {
            tenant: { connect: { id: tenantId } },
            order: { connect: { id: orderId } },
            revenue: new Prisma.Decimal(snapshot.revenue),
            cogs: new Prisma.Decimal(snapshot.cogs),
            fees: new Prisma.Decimal(snapshot.fees),
            shipping: new Prisma.Decimal(snapshot.shipping),
            ads_cost: new Prisma.Decimal(snapshot.ads_cost),
            net_profit: new Prisma.Decimal(snapshot.net_profit),
            margin_percent: new Prisma.Decimal(snapshot.margin_percent),
            calculated_at: new Date(),
        },
        update: {
            revenue: new Prisma.Decimal(snapshot.revenue),
            cogs: new Prisma.Decimal(snapshot.cogs),
            fees: new Prisma.Decimal(snapshot.fees),
            shipping: new Prisma.Decimal(snapshot.shipping),
            ads_cost: new Prisma.Decimal(snapshot.ads_cost),
            net_profit: new Prisma.Decimal(snapshot.net_profit),
            margin_percent: new Prisma.Decimal(snapshot.margin_percent),
            calculated_at: new Date(),
        },
    });

    logger.info('Order profit calculated', { orderId, tenantId, netProfit: snapshot.net_profit, margin: snapshot.margin_percent });
    return result;
}

export async function getOrderProfit(tenantId: string, orderId: string) {
    return prisma.orderProfit.findFirst({ where: { order_id: orderId, tenant_id: tenantId } });
}

// ─── Analytics ───────────────────────────────────────────────────

export async function listProfitAnalytics(tenantId: string, query: {
    store_id?: string; from?: string; to?: string; channel?: string;
    min_margin?: number; max_margin?: number; page: number; page_size: number;
}) {
    const where: Prisma.OrderProfitWhereInput = { tenant_id: tenantId };

    // Margin filters
    if (query.min_margin !== undefined || query.max_margin !== undefined) {
        where.margin_percent = {};
        if (query.min_margin !== undefined) where.margin_percent.gte = new Prisma.Decimal(query.min_margin);
        if (query.max_margin !== undefined) where.margin_percent.lte = new Prisma.Decimal(query.max_margin);
    }

    // Order-level filters
    const orderWhere: Prisma.OrderWhereInput = {};
    if (query.store_id) orderWhere.store_id = query.store_id;
    if (query.channel) orderWhere.channel = query.channel;
    if (query.from || query.to) {
        orderWhere.created_at = {};
        if (query.from) orderWhere.created_at.gte = new Date(query.from);
        if (query.to) orderWhere.created_at.lte = new Date(query.to);
    }
    if (Object.keys(orderWhere).length > 0) where.order = orderWhere;

    const [profits, total] = await Promise.all([
        prisma.orderProfit.findMany({
            where,
            orderBy: { calculated_at: 'desc' },
            skip: (query.page - 1) * query.page_size,
            take: query.page_size,
            include: {
                order: { select: { external_order_number: true, channel: true, currency: true, total: true, created_at: true } },
            },
        }),
        prisma.orderProfit.count({ where }),
    ]);

    // Summary
    const allProfits = await prisma.orderProfit.findMany({ where, select: { revenue: true, net_profit: true } });
    const totalRevenue = allProfits.reduce((s, p) => s + Number(p.revenue), 0);
    const totalNetProfit = allProfits.reduce((s, p) => s + Number(p.net_profit), 0);
    const avgMargin = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;

    return {
        profits, total, page: query.page, pageSize: query.page_size,
        summary: {
            total_revenue: Number(totalRevenue.toFixed(2)),
            total_net_profit: Number(totalNetProfit.toFixed(2)),
            avg_margin: Number(avgMargin.toFixed(2)),
            order_count: allProfits.length,
        },
    };
}
