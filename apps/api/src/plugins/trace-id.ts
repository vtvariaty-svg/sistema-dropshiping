import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { v4 as uuidv4 } from 'uuid';

const traceIdPlugin: FastifyPluginCallback = (fastify, _opts, done) => {
    fastify.addHook('onRequest', async (request) => {
        const incoming = request.headers['x-trace-id'];
        request.traceId = typeof incoming === 'string' && incoming.length > 0
            ? incoming
            : uuidv4();
    });

    fastify.addHook('onSend', async (request, reply) => {
        void reply.header('x-trace-id', request.traceId);
    });

    done();
};

export default fp(traceIdPlugin, { name: 'trace-id' });
