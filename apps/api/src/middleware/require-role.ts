import { FastifyRequest, FastifyReply } from 'fastify';

export function requireRole(allowedRoles: string[]) {
    return async function checkRole(
        request: FastifyRequest,
        reply: FastifyReply,
    ): Promise<void> {
        const user = request.currentUser;

        if (!user) {
            reply.code(401).send({ error: 'Authentication required' });
            return;
        }

        if (!allowedRoles.includes(user.role)) {
            reply.code(403).send({ error: 'Insufficient permissions' });
            return;
        }
    };
}
