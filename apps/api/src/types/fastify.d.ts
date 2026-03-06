import 'fastify';

declare module 'fastify' {
    interface FastifyRequest {
        currentUser?: {
            userId: string;
            tenantId: string;
            role: string;
        };
        traceId: string;
    }
}
