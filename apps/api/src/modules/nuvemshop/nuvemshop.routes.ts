import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { getInstallUrl, authorizeCallback } from './nuvemshop.service';

export async function nuvemshopRoutes(fastify: FastifyInstance) {

    // ─── OAuth Flow ────────────────────────────────────────────────
    
    // Step 1: Redirect to Nuvemshop OAuth
    fastify.get('/auth/install', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const url = getInstallUrl(request.currentUser!.tenantId);
            return reply.send({ url });
        } catch (err) {
            return reply.code(400).send({ error: err instanceof Error ? err.message : 'Install failed' });
        }
    });

    // Step 2: Callback from Nuvemshop (Receives ?code=XYZ&state=ABC)
    fastify.get('/auth/callback', async (request: FastifyRequest, reply: FastifyReply) => {
        const { code, state } = request.query as { code?: string; state?: string };
        if (!code) return reply.code(400).send({ error: 'Missing authorization code' });
        if (!state) return reply.code(400).send({ error: 'Missing state' });
        
        try {
            // Verify state to get tenantId
            const { verifyState } = require('./nuvemshop.service');
            const tenantId = verifyState(state);

            await authorizeCallback(code, tenantId);
            // Redirect back to dashboard integrations page
            return reply.redirect(`${env.WEB_BASE_URL}/dashboard/integrations/nuvemshop?success=1`);
        } catch (err) {
            logger.error('Nuvemshop callback error', { error: err instanceof Error ? err.message : 'Unknown' });
            return reply.redirect(`${env.WEB_BASE_URL}/dashboard/integrations/nuvemshop?error=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown')}`);
        }
    });

    // ─── Stores Management ──────────────────────────────────────────

    fastify.get('/stores', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const stores = await prisma.nuvemshopStore.findMany({
            where: { tenant_id: request.currentUser!.tenantId },
            select: { id: true, store_id: true, name: true, status: true, created_at: true },
        });
        return reply.send(stores);
    });

    fastify.delete('/stores/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const store = await prisma.nuvemshopStore.findFirst({
            where: { id, tenant_id: request.currentUser!.tenantId },
        });
        if (!store) return reply.code(404).send({ error: 'Store not found' });

        await prisma.nuvemshopStore.update({
            where: { id },
            data: { status: 'inactive' },
        });
        return reply.send({ success: true, message: 'Store disconnected' });
    });
}
