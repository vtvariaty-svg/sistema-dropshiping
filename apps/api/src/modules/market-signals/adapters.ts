/**
 * Source Adapter Interface + Implementions
 * Each adapter collects external market signals for a given query.
 * Adapters return normalized snapshots that get persisted by the service layer.
 */
import { logger } from '../../lib/logger';

// ─── Adapter Interface ──────────────────────────────────────────

export interface ShopeeResult {
    priceAvg: number | null;
    salesEst: number | null;
    sellersCount: number | null;
    ratingAvg: number | null;
    reviewsCount: number | null;
    snapshotAt: Date;
}

export interface TiktokResult {
    videosCount: number | null;
    viewsTotal: number | null;
    likesAvg: number | null;
    growthRate: number | null;
    snapshotAt: Date;
}

// ─── Shopee Adapter ─────────────────────────────────────────────
/**
 * Shopee source adapter v1
 * In MVP: generates deterministic simulated signals based on query hash.
 * Architecture is ready for real API/scraping integration.
 */
export async function shopeeAdapter(query: string): Promise<ShopeeResult> {
    logger.info('Shopee adapter collecting', { query });

    // Deterministic seed from query for consistent simulated data
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
        hash = ((hash << 5) - hash) + query.charCodeAt(i);
        hash = hash & hash; // 32-bit int
    }
    const seed = Math.abs(hash);

    // Simulated marketplace signals (deterministic per query)
    const priceAvg = 15 + (seed % 200);
    const salesEst = (seed % 5000) + 10;
    const sellersCount = (seed % 50) + 1;
    const ratingAvg = 3.0 + ((seed % 20) / 10);
    const reviewsCount = (seed % 2000) + 5;

    return {
        priceAvg: Number(priceAvg.toFixed(2)),
        salesEst: Number(salesEst.toFixed(0)),
        sellersCount,
        ratingAvg: Number(Math.min(ratingAvg, 5.0).toFixed(2)),
        reviewsCount,
        snapshotAt: new Date(),
    };
}

// ─── TikTok Adapter ─────────────────────────────────────────────
/**
 * TikTok source adapter v1
 * In MVP: generates deterministic simulated signals based on query hash.
 * Architecture is ready for real API integration.
 */
export async function tiktokAdapter(query: string): Promise<TiktokResult> {
    logger.info('TikTok adapter collecting', { query });

    let hash = 0;
    for (let i = 0; i < query.length; i++) {
        hash = ((hash << 5) - hash) + query.charCodeAt(i);
        hash = hash & hash;
    }
    const seed = Math.abs(hash);

    const videosCount = (seed % 500) + 1;
    const viewsTotal = (seed % 5000000) + 1000;
    const likesAvg = (seed % 10000) + 50;
    const growthRate = ((seed % 100) - 30) / 10; // -3.0 to 7.0

    return {
        videosCount,
        viewsTotal,
        likesAvg: Number(likesAvg.toFixed(2)),
        growthRate: Number(growthRate.toFixed(4)),
        snapshotAt: new Date(),
    };
}
