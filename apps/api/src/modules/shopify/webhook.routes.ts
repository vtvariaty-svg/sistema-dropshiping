import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env';
import { verifyWebhookHmac } from '../../lib/shopify';
import { logger } from '../../lib/logger';
import { getStoreByIdUnsafe } from './shopify.service';
import { storeWebhookAndEnqueue, retryWebhook } from './webhook.service';
import { authenticate } from '../../middleware/authenticate';

export async function webhookRoutes(fastify: FastifyInstance) {
    // Override JSON parser to preserve raw body for HMAC
    fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
        (req as Record<string, unknown>).rawBody = body;
        try {
            done(null, JSON.parse(body.toString()));
        } catch (err) {
            done(err as Error);
        }
    });

    // POST /webhooks/shopify/:storeId — called by Shopify (no auth, uses HMAC)
    fastify.post('/:storeId', async (request, reply) => {
        const { storeId } = request.params as { storeId: string };
        const hmac = request.headers['x-shopify-hmac-sha256'] as string | undefined;
        const topic = request.headers['x-shopify-topic'] as string || 'unknown';
        const shopifyWebhookId = (request.headers['x-shopify-webhook-id'] as string) || uuidv4();
        const rawBody = request.rawBody;

        if (!hmac || !rawBody) {
            return reply.code(401).send({ error: 'Missing HMAC' });
        }

        if (!verifyWebhookHmac(rawBody, hmac, env.SHOPIFY_API_SECRET)) {
            logger.warn('Invalid webhook HMAC', { storeId, topic, traceId: request.traceId });
            return reply.code(401).send({ error: 'Invalid HMAC signature' });
        }

        const store = await getStoreByIdUnsafe(storeId);
        if (!store) {
            return reply.code(404).send({ error: 'Store not found' });
        }

        // Store and enqueue — respond immediately
        await storeWebhookAndEnqueue({
            tenantId: store.tenant_id,
            storeId: store.id,
            topic,
            webhookId: shopifyWebhookId,
            payload: request.body,
            traceId: request.traceId,
        });

        return reply.code(200).send({ received: true });
    });
}

export async function webhookRetryRoutes(fastify: FastifyInstance) {
    // POST /shopify/webhooks/:id/retry (authenticated)
    fastify.post('/shopify/webhooks/:id/retry', { preHandler: [authenticate] }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const user = request.currentUser!;
        try {
            const result = await retryWebhook(id, user.tenantId, request.traceId);
            return reply.send(result);
        } catch (err) {
            return reply.code(400).send({ error: err instanceof Error ? err.message : 'Retry failed' });
        }
    });
}
