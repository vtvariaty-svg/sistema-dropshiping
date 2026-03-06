import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';

async function main() {
    const app = await buildApp();

    try {
        await app.listen({ port: env.PORT, host: '0.0.0.0' });
        logger.info(`🚀 API server running`, {
            url: `${env.APP_BASE_URL}`,
            environment: env.NODE_ENV,
        });
    } catch (err) {
        logger.error('Failed to start server', {
            error: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined,
        });
        process.exit(1);
    }
}

main();
