import { z } from 'zod';

export const createSupplierSchema = z.object({
    name: z.string().min(1), contact_email: z.string().email().optional().nullable(),
    contact_name: z.string().optional().nullable(), phone: z.string().optional().nullable(),
    notes: z.string().optional().nullable(), status: z.string().default('active'),
});
export const updateSupplierSchema = createSupplierSchema.partial();

export const createProductSchema = z.object({
    supplier_id: z.string().uuid(), supplier_sku: z.string().min(1), name: z.string().min(1),
    cost: z.number().min(0), currency: z.string().default('USD'),
    stock_hint: z.number().int().optional().nullable(), lead_time_days: z.number().int().optional().nullable(),
    source_url: z.string().optional().nullable(), active: z.boolean().default(true),
});
export const updateProductSchema = createProductSchema.partial();

export const createMappingSchema = z.object({
    channel: z.string().default('SHOPIFY'), store_id: z.string().uuid().optional().nullable(),
    shopify_sku: z.string().optional().nullable(), shopify_variant_id: z.string().optional().nullable(),
    supplier_id: z.string().uuid(), supplier_product_id: z.string().uuid(), active: z.boolean().default(true),
}).refine((d) => d.shopify_sku || d.shopify_variant_id, { message: 'At least one of shopify_sku or shopify_variant_id required' });
export const updateMappingSchema = z.object({
    shopify_sku: z.string().optional().nullable(), shopify_variant_id: z.string().optional().nullable(),
    supplier_id: z.string().uuid().optional(), supplier_product_id: z.string().uuid().optional(),
    active: z.boolean().optional(),
});
