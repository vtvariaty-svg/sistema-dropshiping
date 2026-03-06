import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { env } from './config/env';
import traceIdPlugin from './plugins/trace-id';
import requestLoggerPlugin from './plugins/request-logger';
import { authRoutes } from './modules/auth/auth.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { logger } from './lib/logger';

export async function buildApp() {
    const app = Fastify({
        logger: false, // We use our own structured logger
    });

    // --- Plugins ---
    await app.register(cors, {
        origin: env.WEB_BASE_URL,
        credentials: true,
    });

    await app.register(cookie, {
        secret: env.COOKIE_SECRET,
    });

    await app.register(traceIdPlugin);
    await app.register(requestLoggerPlugin);

    // --- Routes ---
    await app.register(authRoutes);
    await app.register(adminRoutes);

    // --- Health check ---
    app.get('/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // --- Global error handler ---
    app.setErrorHandler((error, request, reply) => {
        logger.error('Unhandled error', {
            traceId: request.traceId,
            tenantId: request.currentUser?.tenantId,
            error: error.message,
            stack: error.stack,
            method: request.method,
            url: request.url,
        });

        const statusCode = error.statusCode ?? 500;
        reply.code(statusCode).send({
            error: statusCode >= 500 ? 'Internal server error' : error.message,
        });
    });

    return app;
}
