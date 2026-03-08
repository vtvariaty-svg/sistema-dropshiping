import { z } from 'zod';

const envSchema = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    COOKIE_SECRET: z.string().min(32),
    PORT: z.coerce.number().default(3001),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
    RENDER_EXTERNAL_URL: z.string().optional(),
    WEB_BASE_URL: z.string().min(1, 'WEB_BASE_URL is required'),
    // Module 1: Shopify
    SHOPIFY_API_KEY: z.string().default(''),
    SHOPIFY_API_SECRET: z.string().default(''),
    SHOPIFY_APP_URL: z.string().default(''),
    // Module 1: Redis (BullMQ)
    REDIS_URL: z.string().default(''),
    // Module 1: Encryption
    ENCRYPTION_KEY: z.string().default(''),
    // Module 9: TikTok Shop
    TIKTOK_SHOP_APP_KEY: z.string().default(''),
    TIKTOK_SHOP_APP_SECRET: z.string().default(''),
    TIKTOK_SHOP_APP_URL: z.string().default(''),
    TIKTOK_SHOP_WEBHOOK_SECRET: z.string().default(''),
    TIKTOK_SHOP_API_BASE_URL: z.string().default('https://open-api.tiktokglobalshop.com'),
    // Module 11: Nuvemshop
    NUVEMSHOP_CLIENT_ID: z.string().default(''),
    NUVEMSHOP_CLIENT_SECRET: z.string().default(''),
});

function loadEnv() {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
        process.exit(1);
    }
    const data = parsed.data;
    const appBaseUrl = data.RENDER_EXTERNAL_URL || `http://0.0.0.0:${data.PORT}`;
    return {
        ...data,
        APP_BASE_URL: appBaseUrl,
        SHOPIFY_APP_URL: data.SHOPIFY_APP_URL || appBaseUrl,
    };
}

export const env = loadEnv();
export type Env = ReturnType<typeof loadEnv>;
