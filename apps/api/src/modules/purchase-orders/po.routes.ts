import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
    createPurchaseOrdersFromOrder, generatePurchaseOrderArtifacts,
    dispatchPurchaseOrder, cancelPurchaseOrder,
    listPurchaseOrders, getPurchaseOrderDetail, getArtifactContent,
} from './po.service';
import { listPOsSchema } from './po.schemas';

export async function purchaseOrderRoutes(fastify: FastifyInstance) {
    // POST /orders/:id/create-po
    fastify.post('/orders/:id/create-po', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const { id } = req.params as { id: string };
        try {
            const pos = await createPurchaseOrdersFromOrder(req.currentUser!.tenantId, id);
            return reply.code(201).send({ purchase_orders: pos });
        } catch (err) {
            return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' });
        }
    });

    // GET /purchase-orders
    fastify.get('/purchase-orders', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = listPOsSchema.safeParse(req.query);
        if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });
        return reply.send(await listPurchaseOrders(req.currentUser!.tenantId, parsed.data));
    });

    // GET /purchase-orders/:id
    fastify.get('/purchase-orders/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const po = await getPurchaseOrderDetail(req.currentUser!.tenantId, (req.params as { id: string }).id);
        return po ? reply.send(po) : reply.code(404).send({ error: 'Not found' });
    });

    // POST /purchase-orders/:id/generate-artifacts
    fastify.post('/purchase-orders/:id/generate-artifacts', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const artifacts = await generatePurchaseOrderArtifacts(req.currentUser!.tenantId, (req.params as { id: string }).id);
            return reply.send({ artifacts });
        } catch (err) {
            return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' });
        }
    });

    // POST /purchase-orders/:id/dispatch
    fastify.post('/purchase-orders/:id/dispatch', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const po = await dispatchPurchaseOrder(req.currentUser!.tenantId, (req.params as { id: string }).id);
            return reply.send(po);
        } catch (err) {
            return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' });
        }
    });

    // POST /purchase-orders/:id/cancel
    fastify.post('/purchase-orders/:id/cancel', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const po = await cancelPurchaseOrder(req.currentUser!.tenantId, (req.params as { id: string }).id);
            return reply.send(po);
        } catch (err) {
            return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' });
        }
    });

    // GET /purchase-orders/:id/artifacts/:artifactId/download
    fastify.get('/purchase-orders/:id/artifacts/:artifactId/download', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const p = req.params as { id: string; artifactId: string };
        const artifact = await getArtifactContent(req.currentUser!.tenantId, p.id, p.artifactId);
        if (!artifact) return reply.code(404).send({ error: 'Not found' });
        const contentType = artifact.type === 'CSV' ? 'text/csv' : 'application/json';
        const ext = artifact.type === 'CSV' ? 'csv' : 'json';
        reply.header('Content-Type', contentType);
        reply.header('Content-Disposition', `attachment; filename="po-${p.id}.${ext}"`);
        return reply.send(artifact.content);
    });
}
