import { z } from 'zod';

const envSchema = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
    COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 chars'),
    PORT: z.coerce.number().default(3001),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
    // Render provides RENDER_EXTERNAL_URL automatically
    RENDER_EXTERNAL_URL: z.string().optional(),
    // WEB_BASE_URL for CORS — required in production
    WEB_BASE_URL: z.string().min(1, 'WEB_BASE_URL is required'),
});

function loadEnv() {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        console.error(
            '❌ Invalid environment variables:',
            JSON.stringify(parsed.error.format(), null, 2),
        );
        process.exit(1);
    }

    const data = parsed.data;

    return {
        ...data,
        APP_BASE_URL: data.RENDER_EXTERNAL_URL || `http://0.0.0.0:${data.PORT}`,
    };
}

export const env = loadEnv();
export type Env = ReturnType<typeof loadEnv>;
