import { z } from 'zod';

export const listPOsSchema = z.object({
    status: z.string().optional(),
    supplier_id: z.string().uuid().optional(),
    order_id: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListPOsQuery = z.infer<typeof listPOsSchema>;
