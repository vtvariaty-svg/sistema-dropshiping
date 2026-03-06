import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
    createCollectionJob, listJobs, listMarketMetrics, listTiktokMetrics,
    getClusterSummary, computeClusterExternalSummary,
} from './market-signals.service';
import { computeProductScore } from '../intelligence/intelligence.service';
import { collectSchema, jobsQuerySchema, metricsQuerySchema } from './market-signals.schemas';

export async function marketSignalRoutes(fastify: FastifyInstance) {
    // ─── Jobs ─────────────────────────────────────────────────
    fastify.get('/market-signals/jobs', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = jobsQuerySchema.safeParse(req.query);
        if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });
        return reply.send(await listJobs(req.currentUser!.tenantId, parsed.data));
    });

    fastify.post('/market-signals/collect', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = collectSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
        try {
            return reply.code(201).send(await createCollectionJob(req.currentUser!.tenantId, parsed.data));
        } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    // ─── Metrics ──────────────────────────────────────────────
    fastify.get('/market-signals/market-metrics', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = metricsQuerySchema.safeParse(req.query);
        if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });
        return reply.send(await listMarketMetrics(req.currentUser!.tenantId, parsed.data));
    });

    fastify.get('/market-signals/tiktok-metrics', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = metricsQuerySchema.safeParse(req.query);
        if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });
        return reply.send(await listTiktokMetrics(req.currentUser!.tenantId, parsed.data));
    });

    // ─── Cluster Summary ──────────────────────────────────────
    fastify.get('/market-signals/clusters/:id/summary', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.send(await getClusterSummary(req.currentUser!.tenantId, (req.params as { id: string }).id));
        } catch (err) { return reply.code(404).send({ error: 'Not found' }); }
    });

    fastify.post('/market-signals/clusters/:id/recompute-summary', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.send(await computeClusterExternalSummary(req.currentUser!.tenantId, (req.params as { id: string }).id));
        } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    fastify.post('/market-signals/clusters/:id/recompute-score', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.send(await computeProductScore(req.currentUser!.tenantId, (req.params as { id: string }).id));
        } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' }); }
    });
}
