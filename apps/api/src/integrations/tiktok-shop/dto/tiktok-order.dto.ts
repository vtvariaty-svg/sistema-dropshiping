/**
 * TikTok Shop order status → Internal status mapping.
 */

const FINANCIAL_STATUS_MAP: Record<string, string> = {
    'UNPAID': 'pending',
    'ON_HOLD': 'pending',
    'AWAITING_SHIPMENT': 'paid',
    'AWAITING_COLLECTION': 'paid',
    'PARTIALLY_SHIPPING': 'paid',
    'IN_TRANSIT': 'paid',
    'DELIVERED': 'paid',
    'COMPLETED': 'paid',
    'CANCELLED': 'refunded',
};

const FULFILLMENT_STATUS_MAP: Record<string, string | null> = {
    'UNPAID': null,
    'ON_HOLD': null,
    'AWAITING_SHIPMENT': null,
    'AWAITING_COLLECTION': null,
    'PARTIALLY_SHIPPING': 'partial',
    'IN_TRANSIT': 'fulfilled',
    'DELIVERED': 'fulfilled',
    'COMPLETED': 'fulfilled',
    'CANCELLED': null,
};

export function mapTikTokOrderStatusToInternalFinancialStatus(status: string): string {
    return FINANCIAL_STATUS_MAP[status] ?? 'unknown';
}

export function mapTikTokFulfillmentStatusToInternalFulfillmentStatus(status: string): string | null {
    return FULFILLMENT_STATUS_MAP[status] ?? null;
}

export interface TikTokNormalizedOrder {
    tenant_id: string;
    channel: string;
    tiktok_shop_id: string;
    external_order_id: string;
    external_order_number: string;
    financial_status: string;
    fulfillment_status: string | null;
    currency: string;
    subtotal: string;
    shipping: string;
    discounts: string;
    total: string;
}

export interface TikTokNormalizedItem {
    tenant_id: string;
    order_id: string;
    external_line_item_id: string;
    sku: string | null;
    variant_id: string | null;
    title: string;
    qty: number;
    price: string;
    discount: string;
}

export interface TikTokNormalizedAddress {
    tenant_id: string;
    order_id: string;
    type: string;
    name: string | null;
    phone: string | null;
    address1: string | null;
    address2: string | null;
    city: string | null;
    province: string | null;
    zip: string | null;
    country: string | null;
}
