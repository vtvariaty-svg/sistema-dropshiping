import { z } from 'zod';

export const productSchema = z.object({
    name_raw: z.string().min(1),
    category: z.string().nullable().optional(),
});

export const rankingQuerySchema = z.object({
    recommendation: z.string().optional(),
    min_score: z.coerce.number().optional(),
    max_score: z.coerce.number().optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
});
