import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { shopeeAdapter, tiktokAdapter } from './adapters';

// ─── Collection ──────────────────────────────────────────────────

export async function collectShopeeSignals(tenantId: string, clusterId: string, query: string) {
    const result = await shopeeAdapter(query);
    return prisma.marketMetric.create({
        data: {
            tenant: { connect: { id: tenantId } },
            cluster: { connect: { id: clusterId } },
            source: 'SHOPEE',
            query,
            price_avg: result.priceAvg != null ? new Prisma.Decimal(result.priceAvg) : null,
            sales_est: result.salesEst != null ? new Prisma.Decimal(result.salesEst) : null,
            sellers_count: result.sellersCount,
            rating_avg: result.ratingAvg != null ? new Prisma.Decimal(result.ratingAvg) : null,
            reviews_count: result.reviewsCount,
            snapshot_at: result.snapshotAt,
        },
    });
}

export async function collectTikTokSignals(tenantId: string, clusterId: string, query: string) {
    const result = await tiktokAdapter(query);
    return prisma.tiktokMetric.create({
        data: {
            tenant: { connect: { id: tenantId } },
            cluster: { connect: { id: clusterId } },
            query,
            videos_count: result.videosCount,
            views_total: result.viewsTotal != null ? new Prisma.Decimal(result.viewsTotal) : null,
            likes_avg: result.likesAvg != null ? new Prisma.Decimal(result.likesAvg) : null,
            growth_rate: result.growthRate != null ? new Prisma.Decimal(result.growthRate) : null,
            snapshot_at: result.snapshotAt,
        },
    });
}

// ─── Job Management ──────────────────────────────────────────────

export async function createCollectionJob(tenantId: string, data: { cluster_id: string; source: string; query?: string }) {
    // Get cluster to use name_norm as default query
    const cluster = await prisma.productCluster.findFirst({ where: { id: data.cluster_id, tenant_id: tenantId } });
    if (!cluster) throw new Error('Cluster not found');
    const query = data.query || cluster.name_norm;

    const job = await prisma.marketSignalJob.create({
        data: {
            tenant: { connect: { id: tenantId } },
            cluster: { connect: { id: data.cluster_id } },
            source: data.source,
            query,
            status: 'QUEUED',
        },
    });

    // Execute inline (safe synchronous approach for MVP)
    await executeCollectionJob(tenantId, job.id);
    return prisma.marketSignalJob.findUnique({ where: { id: job.id } });
}

export async function executeCollectionJob(tenantId: string, jobId: string) {
    const job = await prisma.marketSignalJob.findFirst({ where: { id: jobId, tenant_id: tenantId } });
    if (!job || !job.cluster_id) return;

    await prisma.marketSignalJob.update({
        where: { id: jobId },
        data: { status: 'RUNNING', started_at: new Date(), attempts: { increment: 1 } },
    });

    try {
        if (job.source === 'SHOPEE') {
            await collectShopeeSignals(tenantId, job.cluster_id, job.query);
        } else if (job.source === 'TIKTOK') {
            await collectTikTokSignals(tenantId, job.cluster_id, job.query);
        } else {
            throw new Error(`Unknown source: ${job.source}`);
        }

        // Auto-compute summary + score after collection
        await computeClusterExternalSummary(tenantId, job.cluster_id);

        await prisma.marketSignalJob.update({
            where: { id: jobId },
            data: { status: 'SUCCESS', finished_at: new Date(), error: null },
        });
        logger.info('Collection job success', { jobId, tenantId, source: job.source });
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        await prisma.marketSignalJob.update({
            where: { id: jobId },
            data: { status: 'FAILED', finished_at: new Date(), error: errorMsg },
        });
        logger.error('Collection job failed', { jobId, tenantId, error: errorMsg });
    }
}

export async function listJobs(tenantId: string, query: {
    source?: string; status?: string; cluster_id?: string; page: number; page_size: number;
}) {
    const where: Prisma.MarketSignalJobWhereInput = { tenant_id: tenantId };
    if (query.source) where.source = query.source;
    if (query.status) where.status = query.status;
    if (query.cluster_id) where.cluster_id = query.cluster_id;

    const [jobs, total] = await Promise.all([
        prisma.marketSignalJob.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip: (query.page - 1) * query.page_size,
            take: query.page_size,
            include: { cluster: { select: { name_norm: true } } },
        }),
        prisma.marketSignalJob.count({ where }),
    ]);
    return { jobs, total, page: query.page, pageSize: query.page_size };
}

// ─── Metrics Queries ─────────────────────────────────────────────

export async function listMarketMetrics(tenantId: string, query: {
    cluster_id?: string; source?: string; from?: string; to?: string;
}) {
    const where: Prisma.MarketMetricWhereInput = { tenant_id: tenantId };
    if (query.cluster_id) where.cluster_id = query.cluster_id;
    if (query.source) where.source = query.source;
    if (query.from || query.to) {
        where.snapshot_at = {};
        if (query.from) where.snapshot_at.gte = new Date(query.from);
        if (query.to) where.snapshot_at.lte = new Date(query.to);
    }
    return prisma.marketMetric.findMany({ where, orderBy: { snapshot_at: 'desc' }, take: 50 });
}

export async function listTiktokMetrics(tenantId: string, query: {
    cluster_id?: string; from?: string; to?: string;
}) {
    const where: Prisma.TiktokMetricWhereInput = { tenant_id: tenantId };
    if (query.cluster_id) where.cluster_id = query.cluster_id;
    if (query.from || query.to) {
        where.snapshot_at = {};
        if (query.from) where.snapshot_at.gte = new Date(query.from);
        if (query.to) where.snapshot_at.lte = new Date(query.to);
    }
    return prisma.tiktokMetric.findMany({ where, orderBy: { snapshot_at: 'desc' }, take: 50 });
}

// ─── External Summary Computation ────────────────────────────────

/**
 * Compute external demand/competition/viral scores for a cluster
 * based on latest market_metrics and tiktok_metrics.
 *
 * External Demand Score:
 *   From Shopee sales_est + TikTok views_total bands
 *   0 data => null (fallback to internal)
 *
 * External Competition Score:
 *   From Shopee sellers_count (higher sellers = lower score)
 *
 * External Viral Score:
 *   From TikTok videos_count, views_total, likes_avg, growth_rate bands
 */
export async function computeClusterExternalSummary(tenantId: string, clusterId: string) {
    // Latest Shopee snapshot
    const shopee = await prisma.marketMetric.findFirst({
        where: { tenant_id: tenantId, cluster_id: clusterId, source: 'SHOPEE' },
        orderBy: { snapshot_at: 'desc' },
    });

    // Latest TikTok snapshot
    const tiktok = await prisma.tiktokMetric.findFirst({
        where: { tenant_id: tenantId, cluster_id: clusterId },
        orderBy: { snapshot_at: 'desc' },
    });

    let externalDemand: number | null = null;
    let externalCompetition: number | null = null;
    let externalViral: number | null = null;

    // External demand from Shopee sales + TikTok views
    if (shopee && shopee.sales_est) {
        const sales = Number(shopee.sales_est);
        // sales bands: 0=0, 1-50=20, 51-200=40, 201-1000=60, 1001-5000=80, 5000+=100
        if (sales <= 0) externalDemand = 0;
        else if (sales <= 50) externalDemand = 20;
        else if (sales <= 200) externalDemand = 40;
        else if (sales <= 1000) externalDemand = 60;
        else if (sales <= 5000) externalDemand = 80;
        else externalDemand = 100;
    }

    // Blend with TikTok views if available
    if (tiktok && tiktok.views_total) {
        const views = Number(tiktok.views_total);
        let tiktokDemand = 0;
        if (views <= 1000) tiktokDemand = 10;
        else if (views <= 50000) tiktokDemand = 30;
        else if (views <= 500000) tiktokDemand = 60;
        else if (views <= 5000000) tiktokDemand = 80;
        else tiktokDemand = 100;

        externalDemand = externalDemand != null
            ? Math.round((externalDemand * 0.6 + tiktokDemand * 0.4))
            : tiktokDemand;
    }

    // External competition from sellers_count (inverse: more sellers = lower score)
    if (shopee && shopee.sellers_count != null) {
        const sellers = shopee.sellers_count;
        if (sellers <= 3) externalCompetition = 90;
        else if (sellers <= 10) externalCompetition = 70;
        else if (sellers <= 25) externalCompetition = 50;
        else if (sellers <= 50) externalCompetition = 30;
        else externalCompetition = 10;
    }

    // External viral from TikTok signals
    if (tiktok) {
        const videos = tiktok.videos_count ?? 0;
        const growth = Number(tiktok.growth_rate ?? 0);
        const likes = Number(tiktok.likes_avg ?? 0);

        let viralBase = 0;
        if (videos <= 5) viralBase = 10;
        else if (videos <= 20) viralBase = 25;
        else if (videos <= 100) viralBase = 50;
        else if (videos <= 300) viralBase = 75;
        else viralBase = 95;

        // Boost by growth rate
        if (growth > 3) viralBase = Math.min(100, viralBase + 15);
        else if (growth > 1) viralBase = Math.min(100, viralBase + 5);

        // Boost by likes
        if (likes > 5000) viralBase = Math.min(100, viralBase + 10);

        externalViral = viralBase;
    }

    const result = await prisma.clusterMarketSummary.upsert({
        where: { tenant_id_cluster_id: { tenant_id: tenantId, cluster_id: clusterId } },
        create: {
            tenant: { connect: { id: tenantId } },
            cluster: { connect: { id: clusterId } },
            external_demand_score: externalDemand != null ? new Prisma.Decimal(externalDemand) : null,
            external_competition_score: externalCompetition != null ? new Prisma.Decimal(externalCompetition) : null,
            external_viral_score: externalViral != null ? new Prisma.Decimal(externalViral) : null,
            summary_version: 'v1',
            calculated_at: new Date(),
        },
        update: {
            external_demand_score: externalDemand != null ? new Prisma.Decimal(externalDemand) : null,
            external_competition_score: externalCompetition != null ? new Prisma.Decimal(externalCompetition) : null,
            external_viral_score: externalViral != null ? new Prisma.Decimal(externalViral) : null,
            calculated_at: new Date(),
        },
    });

    logger.info('Cluster external summary computed', { clusterId, tenantId, externalDemand, externalCompetition, externalViral });
    return result;
}

export async function getClusterSummary(tenantId: string, clusterId: string) {
    const [summary, shopee, tiktok] = await Promise.all([
        prisma.clusterMarketSummary.findFirst({ where: { tenant_id: tenantId, cluster_id: clusterId } }),
        prisma.marketMetric.findFirst({
            where: { tenant_id: tenantId, cluster_id: clusterId, source: 'SHOPEE' },
            orderBy: { snapshot_at: 'desc' },
        }),
        prisma.tiktokMetric.findFirst({
            where: { tenant_id: tenantId, cluster_id: clusterId },
            orderBy: { snapshot_at: 'desc' },
        }),
    ]);
    return { summary, latestShopee: shopee, latestTiktok: tiktok };
}
