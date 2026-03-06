import { Prisma } from '@prisma/client';
import {
    mapTikTokOrderStatusToInternalFinancialStatus,
    mapTikTokFulfillmentStatusToInternalFulfillmentStatus,
} from '../dto/tiktok-order.dto';

/**
 * Normalizes raw TikTok Shop order data into the internal orders schema.
 */

export function normalizeTikTokOrder(raw: Record<string, unknown>, tenantId: string, tiktokShopId: string) {
    const status = String(raw.order_status ?? raw.status ?? 'UNPAID');
    const payment = raw.payment as Record<string, unknown> | undefined;

    return {
        tenant_id: tenantId,
        channel: 'TIKTOK_SHOP',
        tiktok_shop_id: tiktokShopId,
        store_id: null,
        external_order_id: String(raw.order_id ?? raw.id ?? ''),
        external_order_number: String(raw.order_id ?? raw.id ?? ''),
        financial_status: mapTikTokOrderStatusToInternalFinancialStatus(status),
        fulfillment_status: mapTikTokFulfillmentStatusToInternalFulfillmentStatus(status),
        currency: String(payment?.currency ?? raw.currency ?? 'USD'),
        subtotal: new Prisma.Decimal(String(payment?.sub_total ?? raw.subtotal ?? '0')),
        shipping: new Prisma.Decimal(String(payment?.shipping_fee ?? raw.shipping_fee ?? '0')),
        discounts: new Prisma.Decimal(String(payment?.seller_discount ?? raw.total_discount ?? '0')),
        total: new Prisma.Decimal(String(payment?.total_amount ?? raw.total_amount ?? '0')),
    };
}

interface TikTokLineItem {
    id?: string;
    sku_id?: string;
    product_name?: string;
    sku_name?: string;
    quantity?: number;
    sale_price?: string;
    seller_discount?: string;
    original_price?: string;
}

export function normalizeTikTokItems(raw: Record<string, unknown>, tenantId: string, orderId: string) {
    const items = (raw.item_list ?? raw.line_items ?? []) as TikTokLineItem[];
    return items.map((li) => ({
        tenant_id: tenantId,
        order_id: orderId,
        external_line_item_id: String(li.id ?? li.sku_id ?? ''),
        sku: li.sku_id ? String(li.sku_id) : null,
        variant_id: li.sku_id ? String(li.sku_id) : null,
        title: li.product_name ?? li.sku_name ?? 'Unknown',
        qty: li.quantity ?? 1,
        price: new Prisma.Decimal(li.sale_price ?? li.original_price ?? '0'),
        discount: new Prisma.Decimal(li.seller_discount ?? '0'),
    }));
}

interface TikTokRecipientAddress {
    name?: string;
    phone?: string;
    full_address?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    region?: string;
    zipcode?: string;
    postal_code?: string;
    country?: string;
}

export function normalizeTikTokAddresses(raw: Record<string, unknown>, tenantId: string, orderId: string) {
    const results: Array<{
        tenant_id: string; order_id: string; type: string;
        name: string | null; phone: string | null;
        address1: string | null; address2: string | null;
        city: string | null; province: string | null;
        zip: string | null; country: string | null;
    }> = [];

    const addr = (raw.recipient_address ?? raw.shipping_address) as TikTokRecipientAddress | undefined;
    if (addr) {
        results.push({
            tenant_id: tenantId,
            order_id: orderId,
            type: 'shipping',
            name: addr.name ?? null,
            phone: addr.phone ?? null,
            address1: addr.address_line1 ?? addr.full_address ?? null,
            address2: addr.address_line2 ?? null,
            city: addr.city ?? null,
            province: addr.state ?? addr.region ?? null,
            zip: addr.zipcode ?? addr.postal_code ?? null,
            country: addr.country ?? null,
        });
    }

    return results;
}
