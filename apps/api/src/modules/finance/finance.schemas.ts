import { z } from 'zod';

export const feeProfileSchema = z.object({
    channel: z.string().min(1),
    fee_percent: z.coerce.number().min(0),
    payment_fee_percent: z.coerce.number().min(0),
    fixed_fee: z.coerce.number().min(0),
    active: z.boolean().optional(),
});

export const shippingProfileSchema = z.object({
    name: z.string().min(1),
    rule_type: z.string().min(1),
    avg_shipping_cost: z.coerce.number().min(0),
    active: z.boolean().optional(),
    rule_json: z.unknown().optional(),
});

export const analyticsQuerySchema = z.object({
    store_id: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    channel: z.string().optional(),
    min_margin: z.coerce.number().optional(),
    max_margin: z.coerce.number().optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
});
