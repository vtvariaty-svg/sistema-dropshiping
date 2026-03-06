import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { listOrders, getOrderDetail, getOrderEvents } from './order.service';
import { listOrdersSchema } from './order.schemas';
import { getImportQueue } from '../../lib/queue';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import type { ImportOrderPayload } from '../../workers/import-order.worker';

export async function orderRoutes(fastify: FastifyInstance) {
    // GET /orders
    fastify.get('/orders', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const parsed = listOrdersSchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten().fieldErrors });
        }
        const result = await listOrders(request.currentUser!.tenantId, parsed.data);
        return reply.send(result);
    });

    // GET /orders/:id
    fastify.get('/orders/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const order = await getOrderDetail(id, request.currentUser!.tenantId);
        if (!order) return reply.code(404).send({ error: 'Order not found' });
        return reply.send(order);
    });

    // POST /orders/:id/reimport
    fastify.post('/orders/:id/reimport', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const user = request.currentUser!;

        const order = await prisma.order.findFirst({
            where: { id, tenant_id: user.tenantId },
        });
        if (!order) return reply.code(404).send({ error: 'Order not found' });
        if (!order.store_id) return reply.code(400).send({ error: 'Order has no associated store' });

        const queue = getImportQueue();
        if (!queue) return reply.code(503).send({ error: 'Import queue not available' });

        const payload: ImportOrderPayload = {
            storeId: order.store_id,
            tenantId: user.tenantId,
            externalOrderId: order.external_order_id,
        };

        await queue.add('import_shopify_order', payload, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
        });

        logger.info('Reimport enqueued', { orderId: id, traceId: request.traceId });
        return reply.send({ message: 'Reimport enqueued' });
    });

    // GET /orders/:id/events
    fastify.get('/orders/:id/events', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const events = await getOrderEvents(id, request.currentUser!.tenantId);
        return reply.send(events);
    });
}
