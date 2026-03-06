import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
    registerTrackingForPurchaseOrder, getTrackingForPO,
    syncShopifyFulfillment, getOrderFulfillmentLogs, getPOFulfillmentLogs,
} from './tracking.service';
import { registerTrackingSchema } from './tracking.schemas';

export async function trackingRoutes(fastify: FastifyInstance) {
    // POST /purchase-orders/:id/tracking
    fastify.post('/purchase-orders/:id/tracking', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const { id } = req.params as { id: string };
        const parsed = registerTrackingSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
        try {
            const tracking = await registerTrackingForPurchaseOrder(req.currentUser!.tenantId, id, {
                carrier: parsed.data.carrier ?? null,
                tracking_code: parsed.data.tracking_code,
                tracking_url: parsed.data.tracking_url || null,
            });
            // Enqueue sync (inline for MVP, can be moved to BullMQ later)
            const po = await (await import('../../lib/prisma')).prisma.purchaseOrder.findFirst({ where: { id, tenant_id: req.currentUser!.tenantId } });
            if (po) {
                syncShopifyFulfillment(req.currentUser!.tenantId, po.order_id, id).catch(() => { });
            }
            return reply.code(201).send(tracking);
        } catch (err) {
            return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' });
        }
    });

    // GET /purchase-orders/:id/tracking
    fastify.get('/purchase-orders/:id/tracking', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const tracking = await getTrackingForPO(req.currentUser!.tenantId, (req.params as { id: string }).id);
        return tracking ? reply.send(tracking) : reply.code(404).send({ error: 'No tracking found' });
    });

    // POST /orders/:id/push-fulfillment
    fastify.post('/orders/:id/push-fulfillment', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const { id } = req.params as { id: string };
        try {
            const results = await syncShopifyFulfillment(req.currentUser!.tenantId, id);
            return reply.send({ results });
        } catch (err) {
            return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' });
        }
    });

    // GET /orders/:id/fulfillment-sync-logs
    fastify.get('/orders/:id/fulfillment-sync-logs', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        return reply.send(await getOrderFulfillmentLogs(req.currentUser!.tenantId, (req.params as { id: string }).id));
    });

    // GET /purchase-orders/:id/fulfillment-sync-logs
    fastify.get('/purchase-orders/:id/fulfillment-sync-logs', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        return reply.send(await getPOFulfillmentLogs(req.currentUser!.tenantId, (req.params as { id: string }).id));
    });
}
