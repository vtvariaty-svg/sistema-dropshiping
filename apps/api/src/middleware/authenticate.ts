import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../lib/jwt';
import { logger } from '../lib/logger';

export async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        reply.code(401).send({ error: 'Missing or invalid authorization header' });
        return;
    }

    const token = authHeader.slice(7);

    try {
        const payload = verifyAccessToken(token);
        request.currentUser = {
            userId: payload.userId,
            tenantId: payload.tenantId,
            role: payload.role,
        };
    } catch (err) {
        logger.warn('JWT verification failed', {
            traceId: request.traceId,
            error: err instanceof Error ? err.message : 'Unknown error',
        });
        reply.code(401).send({ error: 'Invalid or expired token' });
    }
}
