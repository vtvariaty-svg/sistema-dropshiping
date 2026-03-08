import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { env } from './config/env';
import traceIdPlugin from './plugins/trace-id';
import requestLoggerPlugin from './plugins/request-logger';
import { authRoutes } from './modules/auth/auth.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { userRoutes } from './modules/users/users.routes';
import { shopifyRoutes } from './modules/shopify/shopify.routes';
import { webhookRoutes, webhookRetryRoutes } from './modules/shopify/webhook.routes';
import { orderRoutes } from './modules/orders/order.routes';
import { supplierRoutes } from './modules/suppliers/supplier.routes';
import { purchaseOrderRoutes } from './modules/purchase-orders/po.routes';
import { trackingRoutes } from './modules/tracking/tracking.routes';
import { financeRoutes } from './modules/finance/finance.routes';
import { intelligenceRoutes } from './modules/intelligence/intelligence.routes';
import { marketSignalRoutes } from './modules/market-signals/market-signals.routes';
import { tiktokIntegrationRoutes, tiktokWebhookRoutes } from './modules/tiktok/tiktok.routes';
import { productRoutes } from './modules/products/product.routes';
import { nuvemshopRoutes } from './modules/nuvemshop/nuvemshop.routes';
import { nuvemshopWebhookRoutes } from './modules/nuvemshop/nuvemshop.webhook.routes';
import { logger } from './lib/logger';

export async function buildApp() {
    const app = Fastify({ logger: false });

    await app.register(cors, {
        origin: [env.WEB_BASE_URL],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Trace-Id'],
    });

    await app.register(cookie, { secret: env.COOKIE_SECRET });
    await app.register(traceIdPlugin);
    await app.register(requestLoggerPlugin);

    // Routes
    await app.register(authRoutes);
    await app.register(adminRoutes);
    await app.register(userRoutes);
    await app.register(shopifyRoutes);
    await app.register(webhookRetryRoutes);
    await app.register(orderRoutes);
    await app.register(supplierRoutes);
    await app.register(purchaseOrderRoutes);
    await app.register(trackingRoutes);
    await app.register(financeRoutes);
    await app.register(intelligenceRoutes);
    await app.register(marketSignalRoutes);
    await app.register(tiktokIntegrationRoutes);
    await app.register(productRoutes);
    await app.register(nuvemshopRoutes, { prefix: '/nuvemshop' });

    // Webhook receivers (encapsulated — custom JSON parsers)
    await app.register(webhookRoutes, { prefix: '/webhooks/shopify' });
    await app.register(tiktokWebhookRoutes, { prefix: '/webhooks/tiktok-shop' });
    await app.register(nuvemshopWebhookRoutes, { prefix: '/webhooks' });

    // Health check
    app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    // Global error handler
    app.setErrorHandler((error, request, reply) => {
        logger.error('Unhandled error', {
            traceId: request.traceId, tenantId: request.currentUser?.tenantId,
            error: error.message, stack: error.stack, method: request.method, url: request.url,
        });
        const statusCode = error.statusCode ?? 500;
        reply.code(statusCode).send({ error: statusCode >= 500 ? 'Internal server error' : error.message });
    });

    return app;
}
