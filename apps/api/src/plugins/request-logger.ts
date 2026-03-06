import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { logger } from '../lib/logger';

const timings = new WeakMap<object, number>();

const requestLoggerPlugin: FastifyPluginCallback = (fastify, _opts, done) => {
    fastify.addHook('onRequest', async (request) => {
        timings.set(request, Date.now());
    });

    fastify.addHook('onResponse', async (request, reply) => {
        const start = timings.get(request) ?? Date.now();
        const durationMs = Date.now() - start;

        logger.info('request completed', {
            method: request.method,
            url: request.url,
            statusCode: reply.statusCode,
            durationMs,
            traceId: request.traceId,
            tenantId: request.currentUser?.tenantId,
            userId: request.currentUser?.userId,
        });
    });

    done();
};

export default fp(requestLoggerPlugin, { name: 'request-logger' });
