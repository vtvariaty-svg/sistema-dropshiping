import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import { prisma } from '../../lib/prisma';
import { getInstallUrl, authorizeCallback } from './nuvemshop.service';

export async function nuvemshopRoutes(fastify: FastifyInstance) {

    // ─── OAuth Flow ────────────────────────────────────────────────
    
    // Step 1: Redirect to Nuvemshop OAuth
    fastify.get('/auth/install', async (_, reply: FastifyReply) => {
        try {
            const url = getInstallUrl();
            return reply.redirect(url);
        } catch (err) {
            return reply.code(400).send({ error: err instanceof Error ? err.message : 'Install failed' });
        }
    });

    // Step 2: Callback from Nuvemshop (Receives ?code=XYZ)
    fastify.get('/auth/callback', async (request: FastifyRequest, reply: FastifyReply) => {
        const { code } = request.query as { code?: string };
        if (!code) return reply.code(400).send({ error: 'Missing authorization code' });

        // Since this redirect is out-of-band (Shopify/Nuvemshop redirects the merchant directly),
        // we might not have a clean session here via cookie (cross-site Cookie rules).
        // For security, a real SaaS generates a 'state' token encoding the tenantId.
        // As a shortcut, we assume the user is logged in via their browser cookie:
        await authenticate(request, reply);
        
        try {
            await authorizeCallback(code, request.currentUser!.tenantId);
            // Redirect back to dashboard integrations page
            return reply.redirect('/dashboard/integrations/nuvemshop?success=1');
        } catch (err) {
            return reply.redirect(`/dashboard/integrations/nuvemshop?error=${encodeURIComponent(err instanceof Error ? err.message : 'Unknown')}`);
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
