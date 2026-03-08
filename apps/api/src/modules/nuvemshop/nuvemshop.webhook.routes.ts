import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

export async function nuvemshopWebhookRoutes(fastify: FastifyInstance) {
    
    // Nuvemshop Webhooks come as POST with application/json
    fastify.post('/nuvemshop', async (request: FastifyRequest, reply: FastifyReply) => {
        const storeId = request.headers['x-linkedstore-id'] as string;
        const topic = request.headers['x-event'] as string;
        const hmacHeader = (request.headers['x-linkedstore-hmac-sha256'] || request.headers['x-tiendanube-hmac-sha256']) as string;

        if (!storeId || !topic || !hmacHeader || !env.NUVEMSHOP_CLIENT_SECRET) {
            return reply.code(401).send({ error: 'Missing headers or configuration' });
        }

        const rawBody = (request as any).rawBody || JSON.stringify(request.body);

        const generatedHash = crypto
            .createHmac('sha256', env.NUVEMSHOP_CLIENT_SECRET)
            .update(rawBody, 'utf8')
            .digest('hex');

        if (generatedHash !== hmacHeader) {
            logger.warn('Nuvemshop Webhook HMAC mismatch', { expected: generatedHash, received: hmacHeader });
            return reply.code(401).send({ error: 'Invalid HMAC signature' });
        }

        // Find the store to associate the webhook with the tenant
        const store = await prisma.nuvemshopStore.findFirst({
            where: { store_id: storeId },
        });

        if (!store) {
            logger.warn('Nuvemshop Webhook received for unknown store', { storeId, topic });
            return reply.code(200).send('Ignored');
        }

        // Save webhook to DB
        await prisma.nuvemshopWebhook.create({
            data: {
                tenant_id: store.tenant_id,
                store_id_ref: store.id,
                topic,
                payload_raw: request.body as any,
                status: 'RECEIVED',
            },
        });

        logger.info('Nuvemshop webhook received and persisted', { storeId, topic });
        return reply.code(200).send('OK');
    });
}
