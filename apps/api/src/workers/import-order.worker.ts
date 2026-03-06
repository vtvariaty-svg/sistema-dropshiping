import { Worker } from 'bullmq';
import { getRedisConnectionOpts, ORDER_IMPORT_QUEUE } from '../lib/queue';
import { importShopifyOrder } from '../modules/orders/order.service';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export interface ImportOrderPayload {
    storeId: string;
    tenantId: string;
    externalOrderId: string;
    sourceWebhookId?: string;
}

async function processImport(payload: ImportOrderPayload) {
    try {
        await importShopifyOrder(payload);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Order import failed', { ...payload, error: errorMsg });

        // Mark webhook failed if present
        if (payload.sourceWebhookId) {
            await prisma.shopifyWebhook.update({
                where: { id: payload.sourceWebhookId },
                data: { status: 'failed', error: errorMsg },
            }).catch(() => { });
        }

        // Dead letter
        await prisma.deadLetterJob.create({
            data: {
                tenant_id: payload.tenantId,
                job_type: 'import_shopify_order',
                payload_json: payload as object,
                error: errorMsg,
                attempts: 1,
            },
        });

        throw err;
    }
}

export function startImportWorker() {
    const connOpts = getRedisConnectionOpts();
    if (!connOpts) {
        logger.warn('Redis not configured — import worker not started');
        return null;
    }

    const worker = new Worker(
        ORDER_IMPORT_QUEUE,
        async (job) => {
            const payload = job.data as ImportOrderPayload;
            await processImport(payload);
        },
        { connection: connOpts, concurrency: 3, removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } },
    );

    worker.on('completed', (job) => logger.info('Import job completed', { jobId: job.id }));
    worker.on('failed', (job, err) => logger.error('Import job failed', { jobId: job?.id, error: err.message }));

    logger.info('Order import worker started');
    return worker;
}
