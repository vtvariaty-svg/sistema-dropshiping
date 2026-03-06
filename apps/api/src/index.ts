import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { startWebhookWorker } from './workers/shopify-webhook.worker';
import { startImportWorker } from './workers/import-order.worker';

async function main() {
    const app = await buildApp();

    try {
        await app.listen({ port: env.PORT, host: '0.0.0.0' });
        logger.info('🚀 API server running', { url: env.APP_BASE_URL, environment: env.NODE_ENV });
    } catch (err) {
        logger.error('Failed to start server', { error: err instanceof Error ? err.message : 'Unknown error' });
        process.exit(1);
    }

    // Start BullMQ workers in-process (Render free tier)
    try { startWebhookWorker(); } catch (err) {
        logger.warn('Webhook worker failed to start', { error: err instanceof Error ? err.message : '' });
    }
    try { startImportWorker(); } catch (err) {
        logger.warn('Import worker failed to start', { error: err instanceof Error ? err.message : '' });
    }
}

main();
