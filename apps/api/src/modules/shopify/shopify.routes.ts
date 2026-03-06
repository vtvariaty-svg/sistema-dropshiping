import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { authenticate } from '../../middleware/authenticate';
import { buildOAuthUrl, verifyOAuthHmac, exchangeCodeForToken } from '../../lib/shopify';
import { createStore, listStores, registerWebhooksForStore, listWebhooks } from './shopify.service';
import { logger } from '../../lib/logger';

interface OAuthState {
    userId: string;
    tenantId: string;
    shop: string;
}

export async function shopifyRoutes(fastify: FastifyInstance) {
    // GET /integrations/shopify/install?shop=xxx&token=xxx
    fastify.get('/integrations/shopify/install', async (request, reply) => {
        const { shop, token } = request.query as { shop?: string; token?: string };
        if (!shop || !token) {
            return reply.code(400).send({ error: 'Missing shop or token parameter' });
        }
        // Verify the access token to get user context
        let payload: { userId: string; tenantId: string };
        try {
            payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string; tenantId: string };
        } catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }

        const state = jwt.sign(
            { userId: payload.userId, tenantId: payload.tenantId, shop } as OAuthState,
            env.JWT_ACCESS_SECRET,
            { expiresIn: '10m' },
        );

        const callbackUrl = `${env.SHOPIFY_APP_URL}/integrations/shopify/callback`;
        const authUrl = buildOAuthUrl(shop, env.SHOPIFY_API_KEY, callbackUrl, state);
        return reply.redirect(authUrl);
    });

    // GET /integrations/shopify/callback
    fastify.get('/integrations/shopify/callback', async (request, reply) => {
        const query = request.query as Record<string, string>;
        const { code, shop, state } = query;

        if (!code || !shop || !state) {
            return reply.code(400).send({ error: 'Missing OAuth parameters' });
        }

        // Verify HMAC
        if (!verifyOAuthHmac(query, env.SHOPIFY_API_SECRET)) {
            logger.warn('Invalid Shopify OAuth HMAC', { shop, traceId: request.traceId });
            return reply.code(401).send({ error: 'Invalid HMAC signature' });
        }

        // Verify state JWT
        let stateData: OAuthState;
        try {
            stateData = jwt.verify(state, env.JWT_ACCESS_SECRET) as OAuthState;
        } catch {
            return reply.code(401).send({ error: 'Invalid or expired state' });
        }

        // Exchange code for access token
        const { accessToken, scope } = await exchangeCodeForToken(shop, code, env.SHOPIFY_API_KEY, env.SHOPIFY_API_SECRET);

        // Store encrypted
        const store = await createStore(stateData.tenantId, shop, accessToken, scope);
        logger.info('Shopify store connected', { tenantId: stateData.tenantId, shop, storeId: store.id, traceId: request.traceId });

        // Auto-register webhooks
        try {
            await registerWebhooksForStore(store.id, stateData.tenantId, request.traceId);
        } catch (err) {
            logger.error('Auto webhook registration failed', { error: err instanceof Error ? err.message : 'unknown', traceId: request.traceId });
        }

        // Redirect to frontend
        return reply.redirect(`${env.WEB_BASE_URL}/dashboard/integrations/shopify?connected=true`);
    });

    // GET /shopify/stores (authenticated)
    fastify.get('/shopify/stores', { preHandler: [authenticate] }, async (request, reply) => {
        const stores = await listStores(request.currentUser!.tenantId);
        return reply.send(stores);
    });

    // POST /shopify/stores/:id/register-webhooks (authenticated)
    fastify.post('/shopify/stores/:id/register-webhooks', { preHandler: [authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const user = request.currentUser!;
        try {
            const results = await registerWebhooksForStore(id, user.tenantId, request.traceId);
            return reply.send({ results });
        } catch (err) {
            return reply.code(404).send({ error: err instanceof Error ? err.message : 'Store not found' });
        }
    });

    // GET /shopify/webhooks (authenticated)
    fastify.get('/shopify/webhooks', { preHandler: [authenticate] }, async (request, reply) => {
        const webhooks = await listWebhooks(request.currentUser!.tenantId);
        return reply.send(webhooks);
    });
}
