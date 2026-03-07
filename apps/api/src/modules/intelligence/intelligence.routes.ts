import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
    listProducts, createProduct, updateProduct, deleteProduct,
    listClusters, getClusterDetail, computeProductScore, recomputeAllProductScores, listRanking,
} from './intelligence.service';
import { productSchema, rankingQuerySchema } from './intelligence.schemas';

export async function intelligenceRoutes(fastify: FastifyInstance) {
    // ─── Products CRUD ────────────────────────────────────────
    fastify.get('/intelligence/products', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        return reply.send(await listProducts(req.currentUser!.tenantId));
    });

    fastify.post('/intelligence/products', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = productSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
        return reply.code(201).send(await createProduct(req.currentUser!.tenantId, parsed.data));
    });

    fastify.put('/intelligence/products/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = productSchema.partial().safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
        try {
            return reply.send(await updateProduct(req.currentUser!.tenantId, (req.params as { id: string }).id, parsed.data));
        } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    fastify.delete('/intelligence/products/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            await deleteProduct(req.currentUser!.tenantId, (req.params as { id: string }).id);
            return reply.send({ ok: true });
        } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    // ─── Intelligence / Clusters ──────────────────────────────
    fastify.get('/intelligence/clusters', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        return reply.send(await listClusters(req.currentUser!.tenantId));
    });

    fastify.get('/intelligence/clusters/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.send(await getClusterDetail(req.currentUser!.tenantId, (req.params as { id: string }).id));
        } catch (err) { return reply.code(404).send({ error: err instanceof Error ? err.message : 'Not found' }); }
    });

    fastify.post('/intelligence/clusters/recompute', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        return reply.send(await recomputeAllProductScores(req.currentUser!.tenantId));
    });

    fastify.post('/intelligence/clusters/:id/recompute', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.send(await computeProductScore(req.currentUser!.tenantId, (req.params as { id: string }).id));
        } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    // ─── Ranking ──────────────────────────────────────────────
    fastify.get('/intelligence/ranking', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = rankingQuerySchema.safeParse(req.query);
        if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });
        return reply.send(await listRanking(req.currentUser!.tenantId, parsed.data));
    });
}
