import { z } from 'zod';

export const listOrdersSchema = z.object({
    status: z.string().optional(),
    store_id: z.string().uuid().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListOrdersQuery = z.infer<typeof listOrdersSchema>;
