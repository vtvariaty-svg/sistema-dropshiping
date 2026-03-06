import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import crypto from 'crypto';

// ─── Score Weights (v1) ──────────────────────────────────────────
const SCORE_WEIGHTS = {
    margin: 0.50,
    demand: 0.30,
    competition: 0.10,
    viral: 0.10,
};
const SCORE_VERSION = 'v1';

// ─── Product Normalization ───────────────────────────────────────

/**
 * Normalize a raw product name:
 * 1. Lowercase
 * 2. Trim
 * 3. Collapse repeated spaces
 * 4. Remove punctuation noise (keep alphanumeric, spaces, hyphens)
 * Generate a deterministic fingerprint (SHA-256 hash of normalized name)
 */
export function normalizeProductName(rawName: string): { normalized: string; fingerprint: string } {
    const normalized = rawName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s\-]/g, '')   // remove punctuation noise
        .replace(/\s+/g, ' ')             // collapse spaces
        .trim();
    const fingerprint = crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32);
    return { normalized, fingerprint };
}

// ─── Cluster Management ──────────────────────────────────────────

export async function ensureClusterForProductName(tenantId: string, rawName: string) {
    const { normalized, fingerprint } = normalizeProductName(rawName);

    const existing = await prisma.productCluster.findUnique({
        where: { tenant_id_fingerprint: { tenant_id: tenantId, fingerprint } },
    });
    if (existing) return existing;

    return prisma.productCluster.create({
        data: {
            tenant: { connect: { id: tenantId } },
            name_norm: normalized,
            fingerprint,
        },
    });
}

// ─── Product CRUD ────────────────────────────────────────────────

export async function listProducts(tenantId: string) {
    return prisma.product.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        include: { cluster_links: { include: { cluster: true } } },
    });
}

export async function createProduct(tenantId: string, data: { name_raw: string; category?: string | null }) {
    const product = await prisma.product.create({
        data: {
            tenant: { connect: { id: tenantId } },
            name_raw: data.name_raw,
            category: data.category ?? null,
        },
    });

    // Auto-create cluster and link
    const cluster = await ensureClusterForProductName(tenantId, data.name_raw);
    await prisma.clusterLink.upsert({
        where: {
            tenant_id_product_id_cluster_id: { tenant_id: tenantId, product_id: product.id, cluster_id: cluster.id },
        },
        create: {
            tenant: { connect: { id: tenantId } },
            product: { connect: { id: product.id } },
            cluster: { connect: { id: cluster.id } },
        },
        update: {},
    });

    logger.info('Product created with cluster', { productId: product.id, clusterId: cluster.id, tenantId });
    return product;
}

export async function updateProduct(tenantId: string, id: string, data: { name_raw?: string; category?: string | null }) {
    const existing = await prisma.product.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) throw new Error('Product not found');
    const updateData: Record<string, unknown> = {};
    if (data.name_raw !== undefined) updateData.name_raw = data.name_raw;
    if (data.category !== undefined) updateData.category = data.category;
    return prisma.product.update({ where: { id }, data: updateData });
}

export async function deleteProduct(tenantId: string, id: string) {
    const existing = await prisma.product.findFirst({ where: { id, tenant_id: tenantId } });
    if (!existing) throw new Error('Product not found');
    await prisma.clusterLink.deleteMany({ where: { product_id: id, tenant_id: tenantId } });
    return prisma.product.delete({ where: { id } });
}

// ─── Cluster Metrics ─────────────────────────────────────────────

/**
 * Compute internal metrics for a product cluster by matching order_items
 * whose title normalizes to the same fingerprint.
 */
export async function computeClusterMetrics(tenantId: string, clusterId: string) {
    const cluster = await prisma.productCluster.findFirst({
        where: { id: clusterId, tenant_id: tenantId },
    });
    if (!cluster) throw new Error('Cluster not found');

    // Find order items whose normalized title matches this cluster fingerprint
    const allItems = await prisma.orderItem.findMany({
        where: { tenant_id: tenantId },
        select: { id: true, title: true, qty: true, price: true, order_id: true },
    });

    // Filter items matching this cluster
    const matchingItems = allItems.filter((item: { title: string }) => {
        const { fingerprint } = normalizeProductName(item.title);
        return fingerprint === cluster.fingerprint;
    });

    const orderIds = [...new Set(matchingItems.map((i: { order_id: string }) => i.order_id))];
    const orderCount = orderIds.length;
    const totalQty = matchingItems.reduce((s: number, i: { qty: number }) => s + i.qty, 0);
    const revenue = matchingItems.reduce((s: number, i: { qty: number; price: Prisma.Decimal }) => s + Number(i.price) * i.qty, 0);

    // Average margin from order_profits
    let avgMargin = 0;
    if (orderIds.length > 0) {
        const profits = await prisma.orderProfit.findMany({
            where: { tenant_id: tenantId, order_id: { in: orderIds } },
            select: { margin_percent: true },
        });
        if (profits.length > 0) {
            avgMargin = profits.reduce((s: number, p: { margin_percent: Prisma.Decimal }) => s + Number(p.margin_percent), 0) / profits.length;
        }
    }

    return { orderCount, totalQty, revenue: Number(revenue.toFixed(2)), avgMargin: Number(avgMargin.toFixed(2)) };
}

// ─── Scoring ─────────────────────────────────────────────────────

/**
 * Margin Score: maps avg margin % to 0-100 band
 * margin <= 0 => 0 | 0-10 => 20 | 10-20 => 40 | 20-30 => 70 | 30+ => 100
 */
function calcMarginScore(avgMargin: number): number {
    if (avgMargin <= 0) return 0;
    if (avgMargin < 10) return 20;
    if (avgMargin < 20) return 40;
    if (avgMargin < 30) return 70;
    return 100;
}

/**
 * Demand Score: maps order count to 0-100
 * 0 orders => 0 | 1-2 => 15 | 3-5 => 30 | 6-10 => 50 | 11-25 => 70 | 26-50 => 85 | 50+ => 100
 */
function calcDemandScore(orderCount: number): number {
    if (orderCount === 0) return 0;
    if (orderCount <= 2) return 15;
    if (orderCount <= 5) return 30;
    if (orderCount <= 10) return 50;
    if (orderCount <= 25) return 70;
    if (orderCount <= 50) return 85;
    return 100;
}

/**
 * Get recommendation from final score
 */
function getRecommendation(score: number): string {
    if (score >= 80) return 'SCALE';
    if (score >= 60) return 'TEST';
    if (score >= 40) return 'MONITOR';
    return 'AVOID';
}

export async function computeProductScore(tenantId: string, clusterId: string) {
    const metrics = await computeClusterMetrics(tenantId, clusterId);

    const marginScore = calcMarginScore(metrics.avgMargin);
    let demandScore = calcDemandScore(metrics.orderCount);
    let competitionScore = 50; // neutral placeholder
    let viralScore = 50;       // neutral placeholder
    let version = 'v1';

    // v2: Blend with external market summary if available
    const externalSummary = await prisma.clusterMarketSummary.findFirst({
        where: { tenant_id: tenantId, cluster_id: clusterId },
    });

    if (externalSummary) {
        version = 'v2';
        // Blend demand: 60% internal + 40% external
        if (externalSummary.external_demand_score != null) {
            demandScore = Math.round(demandScore * 0.6 + Number(externalSummary.external_demand_score) * 0.4);
        }
        // External competition replaces placeholder when available
        if (externalSummary.external_competition_score != null) {
            competitionScore = Number(externalSummary.external_competition_score);
        }
        // External viral replaces placeholder when available
        if (externalSummary.external_viral_score != null) {
            viralScore = Number(externalSummary.external_viral_score);
        }
    }

    const finalScore =
        marginScore * SCORE_WEIGHTS.margin +
        demandScore * SCORE_WEIGHTS.demand +
        competitionScore * SCORE_WEIGHTS.competition +
        viralScore * SCORE_WEIGHTS.viral;

    const recommendation = getRecommendation(finalScore);

    // Upsert score
    const result = await prisma.productScore.upsert({
        where: { tenant_id_cluster_id: { tenant_id: tenantId, cluster_id: clusterId } },
        create: {
            tenant: { connect: { id: tenantId } },
            cluster: { connect: { id: clusterId } },
            margin_score: new Prisma.Decimal(marginScore),
            demand_score: new Prisma.Decimal(demandScore),
            competition_score: new Prisma.Decimal(competitionScore),
            viral_score: new Prisma.Decimal(viralScore),
            final_score: new Prisma.Decimal(finalScore),
            recommendation,
            score_version: version,
            calculated_at: new Date(),
        },
        update: {
            margin_score: new Prisma.Decimal(marginScore),
            demand_score: new Prisma.Decimal(demandScore),
            competition_score: new Prisma.Decimal(competitionScore),
            viral_score: new Prisma.Decimal(viralScore),
            final_score: new Prisma.Decimal(finalScore),
            recommendation,
            score_version: version,
            calculated_at: new Date(),
        },
    });

    logger.info('Cluster score computed', { clusterId, tenantId, finalScore, recommendation, version });
    return { ...result, metrics };
}

export async function recomputeAllProductScores(tenantId: string) {
    const clusters = await prisma.productCluster.findMany({ where: { tenant_id: tenantId } });
    const results = [];
    for (const cluster of clusters) {
        try {
            const result = await computeProductScore(tenantId, cluster.id);
            results.push({ clusterId: cluster.id, name: cluster.name_norm, score: Number(result.final_score), recommendation: result.recommendation });
        } catch (err) {
            logger.error('Score compute failed', { clusterId: cluster.id, tenantId, error: err instanceof Error ? err.message : 'Unknown' });
            results.push({ clusterId: cluster.id, name: cluster.name_norm, error: true });
        }
    }
    logger.info('All scores recomputed', { tenantId, count: results.length });
    return results;
}

// ─── Cluster Queries ─────────────────────────────────────────────

export async function listClusters(tenantId: string) {
    return prisma.productCluster.findMany({
        where: { tenant_id: tenantId },
        include: {
            score: true,
            cluster_links: { include: { product: true } },
        },
        orderBy: { created_at: 'desc' },
    });
}

export async function getClusterDetail(tenantId: string, clusterId: string) {
    const cluster = await prisma.productCluster.findFirst({
        where: { id: clusterId, tenant_id: tenantId },
        include: {
            score: true,
            cluster_links: { include: { product: true } },
        },
    });
    if (!cluster) throw new Error('Cluster not found');

    const metrics = await computeClusterMetrics(tenantId, clusterId);
    return { ...cluster, metrics };
}

export async function listRanking(tenantId: string, query: {
    recommendation?: string; min_score?: number; max_score?: number; page: number; page_size: number;
}) {
    const where: Prisma.ProductScoreWhereInput = { tenant_id: tenantId };
    if (query.recommendation) where.recommendation = query.recommendation;
    if (query.min_score !== undefined || query.max_score !== undefined) {
        where.final_score = {};
        if (query.min_score !== undefined) where.final_score.gte = new Prisma.Decimal(query.min_score);
        if (query.max_score !== undefined) where.final_score.lte = new Prisma.Decimal(query.max_score);
    }

    const [scores, total] = await Promise.all([
        prisma.productScore.findMany({
            where,
            orderBy: { final_score: 'desc' },
            skip: (query.page - 1) * query.page_size,
            take: query.page_size,
            include: { cluster: true },
        }),
        prisma.productScore.count({ where }),
    ]);

    return { scores, total, page: query.page, pageSize: query.page_size };
}
