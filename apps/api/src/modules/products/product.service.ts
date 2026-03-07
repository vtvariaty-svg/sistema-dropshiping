import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { getStoreWithToken } from '../shopify/shopify.service';
import { createShopifyProduct, updateShopifyProduct, deleteShopifyProduct } from '../../lib/shopify';
import type { ShopifyProductInput } from '../../lib/shopify';

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

    // Auto-sync to Shopify if requested
    if (data.auto_sync) {
        try {
            await syncProductToShopify(product.id, tenantId);
        } catch (err) {
            logger.error('Auto-sync to Shopify failed', {
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

    // Auto-sync update to Shopify
    if (auto_sync && product.shopify_product_id) {
        try {
            await syncProductToShopify(product.id, tenantId);
        } catch (err) {
            logger.error('Auto-sync update failed', {
                productId: product.id,
                error: err instanceof Error ? err.message : 'unknown',
            });
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
