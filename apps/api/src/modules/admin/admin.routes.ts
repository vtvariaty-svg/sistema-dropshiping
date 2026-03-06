import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/require-role';
import { getTenantById } from './admin.service';

export async function adminRoutes(fastify: FastifyInstance) {
    // GET /admin/tenants/current (admin-only)
    fastify.get(
        '/admin/tenants/current',
        { preHandler: [authenticate, requireRole(['admin'])] },
        async (request, reply) => {
            const user = request.currentUser!;
            const tenant = await getTenantById(user.tenantId);

            if (!tenant) {
                return reply.code(404).send({ error: 'Tenant not found' });
            }

            return reply.code(200).send(tenant);
        },
    );
}
