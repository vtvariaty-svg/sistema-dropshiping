import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { reconcileAllOrdersForTenant } from '../../services/reconciliation';

// ─── Suppliers ───────────────────────────────────────────────────

export async function listSuppliers(tenantId: string) {
    return prisma.supplier.findMany({ where: { tenant_id: tenantId }, orderBy: { created_at: 'desc' } });
}

export async function getSupplier(id: string, tenantId: string) {
    return prisma.supplier.findFirst({ where: { id, tenant_id: tenantId } });
}

export async function createSupplier(tenantId: string, data: Prisma.SupplierCreateInput & { tenant_id?: string }) {
    return prisma.supplier.create({ data: { ...data, tenant_id: tenantId, tenant: { connect: { id: tenantId } } } as Prisma.SupplierCreateInput });
}

export async function createSupplierRaw(tenantId: string, data: Record<string, unknown>) {
    return prisma.supplier.create({
        data: {
            tenant: { connect: { id: tenantId } },
            name: data.name as string,
            contact_email: (data.contact_email as string) ?? null,
            contact_name: (data.contact_name as string) ?? null,
            phone: (data.phone as string) ?? null,
            notes: (data.notes as string) ?? null,
            status: (data.status as string) ?? 'active',
        },
    });
}

export async function updateSupplier(id: string, tenantId: string, data: Record<string, unknown>) {
    const existing = await prisma.supplier.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return null;
    return prisma.supplier.update({ where: { id }, data: data as Prisma.SupplierUpdateInput });
}

export async function deleteSupplier(id: string, tenantId: string) {
    const hasProducts = await prisma.supplierProduct.count({ where: { supplier_id: id, tenant_id: tenantId } });
    if (hasProducts > 0) throw new Error('Cannot delete supplier with existing products');
    const existing = await prisma.supplier.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return null;
    return prisma.supplier.delete({ where: { id } });
}

// ─── Supplier Products ──────────────────────────────────────────

export async function listProducts(tenantId: string, supplierId?: string, active?: boolean) {
    const where: Prisma.SupplierProductWhereInput = { tenant_id: tenantId };
    if (supplierId) where.supplier_id = supplierId;
    if (active !== undefined) where.active = active;
    return prisma.supplierProduct.findMany({ where, include: { supplier: { select: { name: true } } }, orderBy: { created_at: 'desc' } });
}

export async function getProduct(id: string, tenantId: string) {
    return prisma.supplierProduct.findFirst({ where: { id, tenant_id: tenantId }, include: { supplier: { select: { name: true } } } });
}

export async function createProductRaw(tenantId: string, data: Record<string, unknown>) {
    return prisma.supplierProduct.create({
        data: {
            tenant: { connect: { id: tenantId } },
            supplier: { connect: { id: data.supplier_id as string } },
            supplier_sku: data.supplier_sku as string,
            name: data.name as string,
            cost: data.cost as number,
            currency: (data.currency as string) ?? 'USD',
            stock_hint: (data.stock_hint as number) ?? null,
            lead_time_days: (data.lead_time_days as number) ?? null,
            source_url: (data.source_url as string) ?? null,
            active: (data.active as boolean) ?? true,
        },
    });
}

export async function updateProduct(id: string, tenantId: string, data: Record<string, unknown>) {
    const existing = await prisma.supplierProduct.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return null;
    return prisma.supplierProduct.update({ where: { id }, data: data as Prisma.SupplierProductUpdateInput });
}

export async function deleteProduct(id: string, tenantId: string) {
    const hasMappings = await prisma.skuMapping.count({ where: { supplier_product_id: id, tenant_id: tenantId } });
    if (hasMappings > 0) throw new Error('Cannot delete product with existing SKU mappings');
    const existing = await prisma.supplierProduct.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return null;
    return prisma.supplierProduct.delete({ where: { id } });
}

// ─── SKU Mappings ────────────────────────────────────────────────

export async function listMappings(tenantId: string, supplierId?: string, storeId?: string) {
    const where: Prisma.SkuMappingWhereInput = { tenant_id: tenantId };
    if (supplierId) where.supplier_id = supplierId;
    if (storeId) where.store_id = storeId;
    return prisma.skuMapping.findMany({
        where, include: { supplier: { select: { name: true } }, supplier_product: { select: { name: true, supplier_sku: true } } },
        orderBy: { created_at: 'desc' },
    });
}

export async function getMapping(id: string, tenantId: string) {
    return prisma.skuMapping.findFirst({ where: { id, tenant_id: tenantId } });
}

export async function createMappingRaw(tenantId: string, data: Record<string, unknown>) {
    const storeId = data.store_id as string | null | undefined;
    const mapping = await prisma.skuMapping.create({
        data: {
            tenant: { connect: { id: tenantId } },
            channel: (data.channel as string) ?? 'SHOPIFY',
            ...(storeId ? { store: { connect: { id: storeId } } } : {}),
            shopify_sku: (data.shopify_sku as string) ?? null,
            shopify_variant_id: (data.shopify_variant_id as string) ?? null,
            supplier: { connect: { id: data.supplier_id as string } },
            supplier_product: { connect: { id: data.supplier_product_id as string } },
            active: (data.active as boolean) ?? true,
        },
    });
    // Reconcile affected orders
    await reconcileAllOrdersForTenant(tenantId);
    return mapping;
}

export async function updateMapping(id: string, tenantId: string, data: Record<string, unknown>) {
    const existing = await prisma.skuMapping.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return null;
    const updated = await prisma.skuMapping.update({ where: { id }, data: data as Prisma.SkuMappingUpdateInput });
    await reconcileAllOrdersForTenant(tenantId);
    return updated;
}

export async function deleteMapping(id: string, tenantId: string) {
    const existing = await prisma.skuMapping.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) return null;
    const deleted = await prisma.skuMapping.delete({ where: { id } });
    await reconcileAllOrdersForTenant(tenantId);
    return deleted;
}
