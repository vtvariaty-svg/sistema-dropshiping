import { z } from 'zod';

export const registerTrackingSchema = z.object({
    carrier: z.string().optional(),
    tracking_code: z.string().min(1, 'Tracking code is required'),
    tracking_url: z.string().url().optional().or(z.literal('')),
});

export type RegisterTrackingInput = z.infer<typeof registerTrackingSchema>;
