import { z } from 'zod';

const envSchema = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
    COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 chars'),
    APP_BASE_URL: z.string().url('APP_BASE_URL must be a valid URL'),
    WEB_BASE_URL: z.string().url('WEB_BASE_URL must be a valid URL'),
    PORT: z.coerce.number().default(3001),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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
    return parsed.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
