import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { authenticate } from '../../middleware/authenticate';
import { logger } from '../../lib/logger';
import {
    connectTikTokShop,
    refreshTikTokShopToken,
    listTikTokShops,
} from '../../integrations/tiktok-shop/auth/auth-service';
import {
    storeTikTokWebhookAndEnqueue,
    retryTikTokWebhook,
    listTikTokWebhooks,
    listTikTokSyncLogs,
} from '../../integrations/tiktok-shop/webhooks/webhook-service';
import {
    validateWebhookSignature,
    parseWebhookPayload,
} from '../../integrations/tiktok-shop/webhooks/webhook-adapter';
import { prisma } from '../../lib/prisma';

// ─── Auth / Integration Routes (authenticated) ──────────────────

export async function tiktokIntegrationRoutes(fastify: FastifyInstance) {

    // GET /integrations/tiktok/install?token=xxx
    fastify.get('/integrations/tiktok/install', async (request: FastifyRequest, reply: FastifyReply) => {
        const { token } = request.query as { token?: string };
        if (!token) return reply.code(400).send({ error: 'Missing token parameter' });

        let payload: { userId: string; tenantId: string };
        try {
            payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string; tenantId: string };
        } catch {
            return reply.code(401).send({ error: 'Invalid token' });
        }

        const state = jwt.sign(
            { userId: payload.userId, tenantId: payload.tenantId },
            env.JWT_ACCESS_SECRET,
            { expiresIn: '10m' },
        );

        const appKey = env.TIKTOK_SHOP_APP_KEY;
        const appUrl = env.TIKTOK_SHOP_APP_URL || env.APP_BASE_URL;
        const callbackUrl = `${appUrl}/integrations/tiktok/callback`;

        // TikTok Shop OAuth authorization URL
        const authUrl = `https://services.tiktokshop.com/open/authorize?app_key=${appKey}&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`;

        return reply.redirect(authUrl);
    });

    // GET /integrations/tiktok/callback
    fastify.get('/integrations/tiktok/callback', async (request: FastifyRequest, reply: FastifyReply) => {
        const query = request.query as Record<string, string>;
        const { code, state, shop_id, shop_name, region } = query;

        if (!code || !state) {
            return reply.code(400).send({ error: 'Missing OAuth parameters' });
        }

        let stateData: { userId: string; tenantId: string };
        try {
            stateData = jwt.verify(state, env.JWT_ACCESS_SECRET) as { userId: string; tenantId: string };
        } catch {
            return reply.code(401).send({ error: 'Invalid or expired state' });
        }

        try {
            await connectTikTokShop({
                tenantId: stateData.tenantId,
                authCode: code,
                shopId: shop_id,
                shopName: shop_name,
                region,
                traceId: request.traceId,
            });

            return reply.redirect(`${env.WEB_BASE_URL}/dashboard/integrations/tiktok?connected=true`);
        } catch (err) {
            logger.error('TikTok Shop connection failed', {
                error: err instanceof Error ? err.message : 'unknown',
                traceId: request.traceId,
            });
            return reply.redirect(`${env.WEB_BASE_URL}/dashboard/integrations/tiktok?error=auth_failed`);
        }
    });

    // GET /tiktok/shops (authenticated)
    fastify.get('/tiktok/shops', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const shops = await listTikTokShops(request.currentUser!.tenantId);
        return reply.send(shops);
    });

    // POST /tiktok/shops/:id/refresh-token (authenticated)
    fastify.post('/tiktok/shops/:id/refresh-token', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const user = request.currentUser!;
        try {
            const result = await refreshTikTokShopToken(id, user.tenantId, request.traceId);
            return reply.send(result);
        } catch (err) {
            return reply.code(400).send({ error: err instanceof Error ? err.message : 'Refresh failed' });
        }
    });

    // GET /tiktok/webhooks (authenticated)
    fastify.get('/tiktok/webhooks', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const webhooks = await listTikTokWebhooks(request.currentUser!.tenantId);
        return reply.send(webhooks);
    });

    // POST /tiktok/webhooks/:id/retry (authenticated)
    fastify.post('/tiktok/webhooks/:id/retry', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const user = request.currentUser!;
        try {
            const result = await retryTikTokWebhook(id, user.tenantId, request.traceId);
            return reply.send(result);
        } catch (err) {
            return reply.code(400).send({ error: err instanceof Error ? err.message : 'Retry failed' });
        }
    });

    // GET /tiktok/sync-logs (authenticated)
    fastify.get('/tiktok/sync-logs', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const logs = await listTikTokSyncLogs(request.currentUser!.tenantId);
        return reply.send(logs);
    });
}

// ─── Public Webhook Receiver (encapsulated) ─────────────────────

const rawBodies = new WeakMap<FastifyRequest, Buffer>();

export async function tiktokWebhookRoutes(fastify: FastifyInstance) {
    fastify.addContentTypeParser(
        'application/json',
        { parseAs: 'buffer' },
        function (req, body, done) {
            rawBodies.set(req, body as Buffer);
            try {
                done(null, JSON.parse((body as Buffer).toString()));
            } catch (err) {
                done(err as Error);
            }
        },
    );

    // POST /webhooks/tiktok-shop/:shopId
    fastify.post('/:shopId', async (request: FastifyRequest, reply: FastifyReply) => {
        const { shopId } = request.params as { shopId: string };
        const signature = request.headers['x-tts-signature'] as string | undefined;
        const rawBody = rawBodies.get(request);

        // Signature validation via adapter
        if (rawBody && !validateWebhookSignature(rawBody, signature)) {
            logger.warn('Invalid TikTok webhook signature', { shopId, traceId: request.traceId });
            return reply.code(401).send({ error: 'Invalid webhook signature' });
        }

        // Find the TikTok shop
        const shop = await prisma.tiktokShop.findUnique({ where: { id: shopId } });
        if (!shop) {
            return reply.code(404).send({ error: 'TikTok shop not found' });
        }

        const parsed = parseWebhookPayload(request.body as Record<string, unknown>);

        await storeTikTokWebhookAndEnqueue({
            tenantId: shop.tenant_id,
            shopDbId: shop.id,
            eventType: parsed.type,
            eventId: parsed.eventId,
            payload: request.body,
            traceId: request.traceId,
        });

        return reply.code(200).send({ received: true });
    });
}
