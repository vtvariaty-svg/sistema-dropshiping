import { z } from 'zod';

export const collectSchema = z.object({
    cluster_id: z.string().uuid(),
    source: z.enum(['SHOPEE', 'TIKTOK']),
    query: z.string().optional(),
});

export const jobsQuerySchema = z.object({
    source: z.string().optional(),
    status: z.string().optional(),
    cluster_id: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export const metricsQuerySchema = z.object({
    cluster_id: z.string().optional(),
    source: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
});
