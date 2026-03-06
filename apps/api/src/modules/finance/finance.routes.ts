import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
    listFeeProfiles, createFeeProfile, updateFeeProfile, deleteFeeProfile,
    listShippingProfiles, createShippingProfile, updateShippingProfile, deleteShippingProfile,
    getOrderProfit, recalculateOrderProfit, listProfitAnalytics,
} from './finance.service';
import { feeProfileSchema, shippingProfileSchema, analyticsQuerySchema } from './finance.schemas';

export async function financeRoutes(fastify: FastifyInstance) {
    // ─── Fee Profiles ─────────────────────────────────────────
    fastify.get('/fee-profiles', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        return reply.send(await listFeeProfiles(req.currentUser!.tenantId));
    });

    fastify.post('/fee-profiles', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = feeProfileSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
        return reply.code(201).send(await createFeeProfile(req.currentUser!.tenantId, parsed.data));
    });

    fastify.put('/fee-profiles/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = feeProfileSchema.partial().safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
        try {
            return reply.send(await updateFeeProfile(req.currentUser!.tenantId, (req.params as { id: string }).id, parsed.data));
        } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    fastify.delete('/fee-profiles/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            await deleteFeeProfile(req.currentUser!.tenantId, (req.params as { id: string }).id);
            return reply.send({ ok: true });
        } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    // ─── Shipping Profiles ────────────────────────────────────
    fastify.get('/shipping-profiles', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        return reply.send(await listShippingProfiles(req.currentUser!.tenantId));
    });

    fastify.post('/shipping-profiles', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = shippingProfileSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
        return reply.code(201).send(await createShippingProfile(req.currentUser!.tenantId, parsed.data));
    });

    fastify.put('/shipping-profiles/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = shippingProfileSchema.partial().safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
        try {
            return reply.send(await updateShippingProfile(req.currentUser!.tenantId, (req.params as { id: string }).id, parsed.data));
        } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    fastify.delete('/shipping-profiles/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            await deleteShippingProfile(req.currentUser!.tenantId, (req.params as { id: string }).id);
            return reply.send({ ok: true });
        } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    // ─── Order Profit ─────────────────────────────────────────
    fastify.get('/orders/:id/profit', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const profit = await getOrderProfit(req.currentUser!.tenantId, (req.params as { id: string }).id);
        return profit ? reply.send(profit) : reply.code(404).send({ error: 'No profit data' });
    });

    fastify.post('/orders/:id/recalculate-profit', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.send(await recalculateOrderProfit(req.currentUser!.tenantId, (req.params as { id: string }).id));
        } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Failed' }); }
    });

    // ─── Analytics ────────────────────────────────────────────
    fastify.get('/analytics/profit', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = analyticsQuerySchema.safeParse(req.query);
        if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });
        return reply.send(await listProfitAnalytics(req.currentUser!.tenantId, parsed.data));
    });
}
