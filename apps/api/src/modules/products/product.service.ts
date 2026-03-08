import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { getStoreWithToken } from '../shopify/shopify.service';
import { createShopifyProduct, updateShopifyProduct, deleteShopifyProduct } from '../../lib/shopify';
import type { ShopifyProductInput } from '../../lib/shopify';

import { getStoreWithToken as getNuvemshopStoreWithToken, nuvemshopApiFetch } from '../nuvemshop/nuvemshop.service';

// ─── CRUD ────────────────────────────────────────────────────────

export async function createProduct(tenantId: string, data: {
    title: string;
    description?: string;
    vendor?: string;
    product_type?: string;
    tags?: string;
    sku?: string;
    price: string;
    compare_at_price?: string;
    inventory_qty?: number;
    image_url?: string;
    auto_sync?: boolean;
}) {
    const product = await prisma.saasProduct.create({
        data: {
            tenant_id: tenantId,
            title: data.title,
            description: data.description ?? '',
            vendor: data.vendor,
            product_type: data.product_type,
            tags: data.tags,
            sku: data.sku,
            price: data.price,
            compare_at_price: data.compare_at_price ?? null,
            inventory_qty: data.inventory_qty ?? 0,
            image_url: data.image_url,
        },
    });

    // Auto-sync to Shopify and Nuvemshop if requested
    if (data.auto_sync) {
        try {
            await syncProductToShopify(product.id, tenantId);
        } catch (err) {
            logger.error('Auto-sync to Shopify failed', {
                productId: product.id,
                error: err instanceof Error ? err.message : 'unknown',
            });
        }
        try {
            await syncProductToNuvemshop(product.id, tenantId);
        } catch (err) {
            logger.warn('Auto-sync to Nuvemshop skipped or failed', {
                productId: product.id,
                error: err instanceof Error ? err.message : 'unknown',
            });
        }
    }

    return product;
}

export async function updateProduct(productId: string, tenantId: string, data: {
    title?: string;
    description?: string;
    vendor?: string;
    product_type?: string;
    tags?: string;
    sku?: string;
    price?: string;
    compare_at_price?: string;
    inventory_qty?: number;
    image_url?: string;
    auto_sync?: boolean;
}) {
    const { auto_sync, ...updateData } = data;
    const product = await prisma.saasProduct.update({
        where: { id: productId },
        data: updateData,
    });

    // Auto-sync update to Shopify and Nuvemshop
    if (auto_sync) {
        if (product.shopify_product_id) {
            try {
                await syncProductToShopify(product.id, tenantId);
            } catch (err) {
                logger.error('Auto-sync Shopify update failed', {
                    productId: product.id,
                    error: err instanceof Error ? err.message : 'unknown',
                });
            }
        }
        if (product.nuvemshop_product_id) {
            try {
                await syncProductToNuvemshop(product.id, tenantId);
            } catch (err) {
                logger.error('Auto-sync Nuvemshop update failed', {
                    productId: product.id,
                    error: err instanceof Error ? err.message : 'unknown',
                });
            }
        }
    }

    return product;
}

export async function deleteProduct(productId: string, tenantId: string) {
    const product = await prisma.saasProduct.findFirst({
        where: { id: productId, tenant_id: tenantId },
    });
    if (!product) throw new Error('Product not found');

    // Delete from Shopify if synced
    if (product.shopify_product_id) {
        try {
            await unsyncProductFromShopify(productId, tenantId);
        } catch (err) {
            logger.error('Shopify product delete failed', {
                productId, error: err instanceof Error ? err.message : 'unknown',
            });
        }
    }

    // Delete from Nuvemshop if synced
    if (product.nuvemshop_product_id) {
        try {
            await unsyncProductFromNuvemshop(productId, tenantId);
        } catch (err) {
            logger.error('Nuvemshop product delete failed', {
                productId, error: err instanceof Error ? err.message : 'unknown',
            });
        }
    }

    await prisma.saasProduct.delete({ where: { id: productId } });
    return { deleted: true };
}

export async function listProducts(tenantId: string) {
    return prisma.saasProduct.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        select: {
            id: true, title: true, sku: true, price: true,
            compare_at_price: true, inventory_qty: true, image_url: true,
            shopify_product_id: true, shopify_sync_status: true, shopify_synced_at: true,
            nuvemshop_product_id: true, nuvemshop_sync_status: true, nuvemshop_synced_at: true,
            status: true, created_at: true,
        },
    });
}

export async function getProduct(productId: string, tenantId: string) {
    return prisma.saasProduct.findFirst({
        where: { id: productId, tenant_id: tenantId },
    });
}

// ─── Shopify Sync ────────────────────────────────────────────────

export async function syncProductToShopify(productId: string, tenantId: string) {
    const product = await prisma.saasProduct.findFirst({
        where: { id: productId, tenant_id: tenantId },
    });
    if (!product) throw new Error('Product not found');

    // Find the first active Shopify store for this tenant
    const stores = await prisma.shopifyStore.findMany({
        where: { tenant_id: tenantId, status: 'active' },
    });
    if (stores.length === 0) throw new Error('No active Shopify store connected');

    const store = await getStoreWithToken(stores[0].id, tenantId);
    if (!store) throw new Error('Store not found');

    const shopifyInput: ShopifyProductInput = {
        title: product.title,
        body_html: product.description ?? '',
        vendor: product.vendor ?? undefined,
        product_type: product.product_type ?? undefined,
        tags: product.tags ?? undefined,
        variants: [{
            price: product.price.toString(),
            sku: product.sku ?? undefined,
            inventory_management: 'shopify',
            inventory_quantity: product.inventory_qty,
            compare_at_price: product.compare_at_price?.toString() ?? undefined,
        }],
        images: product.image_url ? [{ src: product.image_url }] : undefined,
    };

    if (product.shopify_product_id) {
        // Update existing
        await updateShopifyProduct(store.shop_domain, store.accessToken, product.shopify_product_id, shopifyInput);
        await prisma.saasProduct.update({
            where: { id: productId },
            data: { shopify_sync_status: 'SYNCED', shopify_synced_at: new Date() },
        });
        logger.info('Product updated on Shopify', { productId, shopifyId: product.shopify_product_id });
    } else {
        // Create new
        const result = await createShopifyProduct(store.shop_domain, store.accessToken, shopifyInput);
        await prisma.saasProduct.update({
            where: { id: productId },
            data: {
                shopify_product_id: String(result.id),
                shopify_sync_status: 'SYNCED',
                shopify_synced_at: new Date(),
            },
        });
        logger.info('Product created on Shopify', { productId, shopifyId: result.id });
    }

    return { synced: true };
}

export async function unsyncProductFromShopify(productId: string, tenantId: string) {
    const product = await prisma.saasProduct.findFirst({
        where: { id: productId, tenant_id: tenantId },
    });
    if (!product || !product.shopify_product_id) throw new Error('Product not synced to Shopify');

    const stores = await prisma.shopifyStore.findMany({
        where: { tenant_id: tenantId, status: 'active' },
    });
    if (stores.length === 0) throw new Error('No active Shopify store');

    const store = await getStoreWithToken(stores[0].id, tenantId);
    if (!store) throw new Error('Store not found');

    await deleteShopifyProduct(store.shop_domain, store.accessToken, product.shopify_product_id);

    await prisma.saasProduct.update({
        where: { id: productId },
        data: { shopify_product_id: null, shopify_sync_status: 'NOT_SYNCED', shopify_synced_at: null },
    });

    logger.info('Product removed from Shopify', { productId });
    return { unsynced: true };
}

// ─── Nuvemshop Sync ──────────────────────────────────────────────

export async function syncProductToNuvemshop(productId: string, tenantId: string) {
    const product = await prisma.saasProduct.findFirst({
        where: { id: productId, tenant_id: tenantId },
    });
    if (!product) throw new Error('Product not found');

    const stores = await prisma.nuvemshopStore.findMany({
        where: { tenant_id: tenantId, status: 'active' },
    });
    if (stores.length === 0) throw new Error('No active Nuvemshop store connected');

    const store = await getNuvemshopStoreWithToken(stores[0].id, tenantId);
    if (!store) throw new Error('Nuvemshop Store credentials not found');

    const nuvemshopInput = {
        name: { pt: product.title },
        description: { pt: product.description ?? '' },
        tags: product.tags ?? undefined,
        variants: [{
            price: product.price.toString(),
            promotional_price: product.compare_at_price?.toString() ?? undefined,
            stock: product.inventory_qty,
            sku: product.sku ?? undefined,
        }],
        images: product.image_url ? [{ src: product.image_url }] : undefined,
    };

    if (product.nuvemshop_product_id) {
        // Update
        await nuvemshopApiFetch(store.store_id, store.accessToken, `/products/${product.nuvemshop_product_id}`, {
            method: 'PUT',
            body: JSON.stringify(nuvemshopInput),
        });
        await prisma.saasProduct.update({
            where: { id: productId },
            data: { nuvemshop_sync_status: 'SYNCED', nuvemshop_synced_at: new Date() },
        });
        logger.info('Product updated on Nuvemshop', { productId, nuvemshopId: product.nuvemshop_product_id });
    } else {
        // Create
        const result = await nuvemshopApiFetch<{ id: number }>(store.store_id, store.accessToken, '/products', {
            method: 'POST',
            body: JSON.stringify(nuvemshopInput),
        });

        await prisma.saasProduct.update({
            where: { id: productId },
            data: {
                nuvemshop_product_id: String(result.id),
                nuvemshop_sync_status: 'SYNCED',
                nuvemshop_synced_at: new Date(),
            },
        });
        logger.info('Product created on Nuvemshop', { productId, nuvemshopId: result.id });
    }

    return { synced: true };
}

export async function unsyncProductFromNuvemshop(productId: string, tenantId: string) {
    const product = await prisma.saasProduct.findFirst({
        where: { id: productId, tenant_id: tenantId },
    });
    if (!product || !product.nuvemshop_product_id) throw new Error('Product not synced to Nuvemshop');

    const stores = await prisma.nuvemshopStore.findMany({
        where: { tenant_id: tenantId, status: 'active' },
    });
    if (stores.length === 0) throw new Error('No active Nuvemshop store');

    const store = await getNuvemshopStoreWithToken(stores[0].id, tenantId);
    if (!store) throw new Error('Store not found');

    await nuvemshopApiFetch(store.store_id, store.accessToken, `/products/${product.nuvemshop_product_id}`, { method: 'DELETE' });

    await prisma.saasProduct.update({
        where: { id: productId },
        data: { nuvemshop_product_id: null, nuvemshop_sync_status: 'NOT_SYNCED', nuvemshop_synced_at: null },
    });

    logger.info('Product removed from Nuvemshop', { productId });
    return { unsynced: true };
}

