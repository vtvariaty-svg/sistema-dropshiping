import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { resolveSupplierMappingForItem } from '../../services/reconciliation';

// ─── Create POs from Order ───────────────────────────────────────

export async function createPurchaseOrdersFromOrder(tenantId: string, orderId: string) {
    const order = await prisma.order.findFirst({
        where: { id: orderId, tenant_id: tenantId },
        include: { items: true, addresses: true },
    });
    if (!order) throw new Error('Order not found');
    if (order.operational_status !== 'READY_FOR_PO') throw new Error(`Order status is ${order.operational_status}, expected READY_FOR_PO`);

    // Idempotency: check existing active POs
    const existingPOs = await prisma.purchaseOrder.findMany({
        where: { order_id: orderId, tenant_id: tenantId, status: { not: 'CANCELLED' } },
        include: { items: true },
    });
    if (existingPOs.length > 0) {
        logger.info('POs already exist for order', { orderId, count: existingPOs.length });
        return existingPOs;
    }

    // Resolve mappings and group by supplier
    const supplierGroups: Record<string, Array<{
        orderItem: typeof order.items[0];
        mapping: { supplier_id: string; supplier_product_id: string; supplier_product: { supplier_sku: string; cost: Prisma.Decimal; name: string } };
    }>> = {};

    for (const item of order.items) {
        const mapping = await resolveSupplierMappingForItem({
            tenantId, channel: order.channel, storeId: order.store_id,
            shopifySku: item.sku, shopifyVariantId: item.variant_id,
        });
        if (!mapping) throw new Error(`No mapping found for item: ${item.title} (SKU: ${item.sku})`);

        const supplierId = mapping.supplier_id;
        if (!supplierGroups[supplierId]) supplierGroups[supplierId] = [];
        supplierGroups[supplierId].push({
            orderItem: item,
            mapping: {
                supplier_id: mapping.supplier_id,
                supplier_product_id: mapping.supplier_product_id,
                supplier_product: mapping.supplier_product,
            },
        });
    }

    // Create POs per supplier
    const createdPOs = [];
    for (const [supplierId, items] of Object.entries(supplierGroups)) {
        const totalCost = items.reduce((sum, i) => {
            const cost = Number(i.mapping.supplier_product.cost);
            return sum + cost * i.orderItem.qty;
        }, 0);

        const po = await prisma.purchaseOrder.create({
            data: {
                tenant: { connect: { id: tenantId } },
                supplier: { connect: { id: supplierId } },
                order: { connect: { id: orderId } },
                status: 'CREATED',
                currency: order.currency,
                total_cost: new Prisma.Decimal(totalCost.toFixed(2)),
            },
        });

        // Create PO items
        const poItems = items.map((i) => ({
            tenant_id: tenantId,
            purchase_order_id: po.id,
            order_item_id: i.orderItem.id,
            supplier_product_id: i.mapping.supplier_product_id,
            supplier_sku: i.mapping.supplier_product.supplier_sku,
            title: i.orderItem.title,
            qty: i.orderItem.qty,
            unit_cost: i.mapping.supplier_product.cost,
            line_total: new Prisma.Decimal((Number(i.mapping.supplier_product.cost) * i.orderItem.qty).toFixed(2)),
        }));
        await prisma.purchaseOrderItem.createMany({ data: poItems });

        // Create event
        await prisma.poEvent.create({
            data: {
                tenant: { connect: { id: tenantId } },
                purchase_order: { connect: { id: po.id } },
                type: 'po_created',
                payload_json: { orderId, supplierId, totalCost, itemCount: items.length },
            },
        });

        createdPOs.push(po);
    }

    // Update order status
    await prisma.order.update({ where: { id: orderId }, data: { operational_status: 'PO_CREATED' } });

    logger.info('Purchase orders created', { orderId, tenantId, poCount: createdPOs.length });
    return createdPOs;
}

// ─── Generate Artifacts ──────────────────────────────────────────

export async function generatePurchaseOrderArtifacts(tenantId: string, poId: string) {
    const po = await prisma.purchaseOrder.findFirst({
        where: { id: poId, tenant_id: tenantId },
        include: {
            items: { include: { supplier_product: true } },
            supplier: true,
            order: { include: { addresses: true } },
        },
    });
    if (!po) throw new Error('Purchase order not found');

    // Check existing artifacts
    const existing = await prisma.poArtifact.findMany({ where: { purchase_order_id: poId, tenant_id: tenantId } });
    const existingTypes = existing.map((a) => a.type);

    const shippingAddr = po.order.addresses.find((a: { type: string }) => a.type === 'shipping');
    const artifacts = [];

    // JSON artifact
    if (!existingTypes.includes('JSON')) {
        const jsonData = {
            purchase_order_id: po.id,
            status: po.status,
            supplier: { name: po.supplier.name, email: po.supplier.contact_email },
            order_reference: po.order.external_order_number,
            shipping: shippingAddr ? {
                name: shippingAddr.name, phone: shippingAddr.phone,
                address1: shippingAddr.address1, city: shippingAddr.city,
                province: shippingAddr.province, zip: shippingAddr.zip, country: shippingAddr.country,
            } : null,
            items: po.items.map((i) => ({
                supplier_sku: i.supplier_sku, title: i.title, qty: i.qty,
                unit_cost: Number(i.unit_cost).toFixed(2), line_total: Number(i.line_total).toFixed(2),
            })),
            total_cost: Number(po.total_cost).toFixed(2),
            currency: po.currency,
            created_at: po.created_at.toISOString(),
        };
        const jsonArtifact = await prisma.poArtifact.create({
            data: {
                tenant: { connect: { id: tenantId } },
                purchase_order: { connect: { id: poId } },
                type: 'JSON',
                content: JSON.stringify(jsonData, null, 2),
            },
        });
        artifacts.push(jsonArtifact);
    }

    // CSV artifact
    if (!existingTypes.includes('CSV')) {
        const header = 'supplier_sku,title,qty,unit_cost,line_total';
        const rows = po.items.map((i) =>
            `"${i.supplier_sku}","${i.title.replace(/"/g, '""')}",${i.qty},${Number(i.unit_cost).toFixed(2)},${Number(i.line_total).toFixed(2)}`
        );
        const shippingLine = shippingAddr
            ? `\n# Shipping: ${shippingAddr.name ?? ''}, ${shippingAddr.address1 ?? ''}, ${shippingAddr.city ?? ''}, ${shippingAddr.province ?? ''}, ${shippingAddr.zip ?? ''}, ${shippingAddr.country ?? ''}`
            : '';
        const csvContent = `# PO: ${po.id}\n# Order: ${po.order.external_order_number}\n# Supplier: ${po.supplier.name}${shippingLine}\n${header}\n${rows.join('\n')}`;

        const csvArtifact = await prisma.poArtifact.create({
            data: {
                tenant: { connect: { id: tenantId } },
                purchase_order: { connect: { id: poId } },
                type: 'CSV',
                content: csvContent,
            },
        });
        artifacts.push(csvArtifact);
    }

    if (artifacts.length > 0) {
        await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: 'READY_TO_DISPATCH' } });
        await prisma.poEvent.create({
            data: {
                tenant: { connect: { id: tenantId } },
                purchase_order: { connect: { id: poId } },
                type: 'artifacts_generated',
                payload_json: { types: artifacts.map((a) => a.type) },
            },
        });
    }

    logger.info('PO artifacts generated', { poId, tenantId, count: artifacts.length });
    return artifacts;
}

// ─── Dispatch PO ─────────────────────────────────────────────────

export async function dispatchPurchaseOrder(tenantId: string, poId: string) {
    const po = await prisma.purchaseOrder.findFirst({
        where: { id: poId, tenant_id: tenantId },
        include: { artifacts: true },
    });
    if (!po) throw new Error('Purchase order not found');
    if (po.status === 'DISPATCHED') return po;
    if (po.artifacts.length === 0) throw new Error('Generate artifacts before dispatching');

    const updated = await prisma.purchaseOrder.update({
        where: { id: poId },
        data: { status: 'DISPATCHED', sent_at: new Date() },
    });

    await prisma.poEvent.create({
        data: {
            tenant: { connect: { id: tenantId } },
            purchase_order: { connect: { id: poId } },
            type: 'po_dispatched',
            payload_json: { dispatchedAt: new Date().toISOString() },
        },
    });

    logger.info('PO dispatched', { poId, tenantId });
    return updated;
}

// ─── Cancel PO ───────────────────────────────────────────────────

export async function cancelPurchaseOrder(tenantId: string, poId: string) {
    const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, tenant_id: tenantId } });
    if (!po) throw new Error('Purchase order not found');
    if (po.status === 'DISPATCHED') throw new Error('Cannot cancel a dispatched PO');

    const updated = await prisma.purchaseOrder.update({
        where: { id: poId },
        data: { status: 'CANCELLED' },
    });

    await prisma.poEvent.create({
        data: {
            tenant: { connect: { id: tenantId } },
            purchase_order: { connect: { id: poId } },
            type: 'po_cancelled',
            payload_json: {},
        },
    });

    logger.info('PO cancelled', { poId, tenantId });
    return updated;
}

// ─── CRUD / Query ────────────────────────────────────────────────

export async function listPurchaseOrders(tenantId: string, query: {
    status?: string; supplier_id?: string; order_id?: string;
    from?: string; to?: string; page: number; page_size: number;
}) {
    const where: Prisma.PurchaseOrderWhereInput = { tenant_id: tenantId };
    if (query.status) where.status = query.status;
    if (query.supplier_id) where.supplier_id = query.supplier_id;
    if (query.order_id) where.order_id = query.order_id;
    if (query.from || query.to) {
        where.created_at = {};
        if (query.from) where.created_at.gte = new Date(query.from);
        if (query.to) where.created_at.lte = new Date(query.to);
    }

    const [pos, total] = await Promise.all([
        prisma.purchaseOrder.findMany({
            where, orderBy: { created_at: 'desc' },
            skip: (query.page - 1) * query.page_size, take: query.page_size,
            include: {
                supplier: { select: { name: true } },
                order: { select: { external_order_number: true } },
            },
        }),
        prisma.purchaseOrder.count({ where }),
    ]);
    return { purchase_orders: pos, total, page: query.page, pageSize: query.page_size };
}

export async function getPurchaseOrderDetail(tenantId: string, poId: string) {
    return prisma.purchaseOrder.findFirst({
        where: { id: poId, tenant_id: tenantId },
        include: {
            supplier: true,
            order: { include: { addresses: true } },
            items: { include: { supplier_product: true } },
            artifacts: { orderBy: { created_at: 'desc' } },
            events: { orderBy: { created_at: 'desc' } },
        },
    });
}

export async function getArtifactContent(tenantId: string, poId: string, artifactId: string) {
    return prisma.poArtifact.findFirst({
        where: { id: artifactId, purchase_order_id: poId, tenant_id: tenantId },
    });
}
