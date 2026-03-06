import { prisma } from '../../../lib/prisma';
import { encrypt, decrypt } from '../../../lib/encryption';
import { env } from '../../../config/env';
import { exchangeCodeForToken, refreshAccessToken } from '../client/tiktok-api-client';
import { logger } from '../../../lib/logger';

/**
 * TikTokShopAuthService — handles store creation, token exchange, and refresh.
 */

export async function connectTikTokShop(params: {
    tenantId: string;
    authCode: string;
    shopId?: string;
    shopName?: string;
    region?: string;
    traceId: string;
}) {
    // Exchange auth code for tokens
    const tokens = await exchangeCodeForToken(params.authCode);

    const accessTokenEnc = encrypt(tokens.access_token, env.ENCRYPTION_KEY);
    const refreshTokenEnc = tokens.refresh_token
        ? encrypt(tokens.refresh_token, env.ENCRYPTION_KEY)
        : null;

    const expiresAt = new Date(Date.now() + tokens.access_token_expire_in * 1000);

    const shop = await prisma.tiktokShop.upsert({
        where: {
            tenant_id_shop_id: {
                tenant_id: params.tenantId,
                shop_id: params.shopId ?? 'pending',
            },
        },
        update: {
            access_token_enc: accessTokenEnc,
            refresh_token_enc: refreshTokenEnc,
            token_expires_at: expiresAt,
            shop_name: params.shopName,
            region: params.region,
            status: 'ACTIVE',
        },
        create: {
            tenant_id: params.tenantId,
            shop_id: params.shopId ?? 'pending',
            shop_name: params.shopName,
            region: params.region,
            app_key: env.TIKTOK_SHOP_APP_KEY || null,
            access_token_enc: accessTokenEnc,
            refresh_token_enc: refreshTokenEnc,
            token_expires_at: expiresAt,
            status: 'ACTIVE',
        },
    });

    // Sync log
    await prisma.tiktokSyncLog.create({
        data: {
            tenant_id: params.tenantId,
            shop_id_ref: shop.id,
            sync_type: 'TOKEN_EXCHANGE',
            status: 'SUCCESS',
            payload_json: { shopId: params.shopId },
        },
    });

    logger.info('TikTok Shop connected', {
        tenantId: params.tenantId,
        tiktokShopId: shop.id,
        traceId: params.traceId,
    });

    return shop;
}

export async function refreshTikTokShopToken(shopDbId: string, tenantId: string, traceId: string) {
    const shop = await prisma.tiktokShop.findFirst({
        where: { id: shopDbId, tenant_id: tenantId },
    });
    if (!shop) throw new Error('TikTok shop not found');
    if (!shop.refresh_token_enc) throw new Error('No refresh token available');

    const refreshToken = decrypt(shop.refresh_token_enc, env.ENCRYPTION_KEY);
    const tokens = await refreshAccessToken(refreshToken);

    const accessTokenEnc = encrypt(tokens.access_token, env.ENCRYPTION_KEY);
    const refreshTokenEnc = tokens.refresh_token
        ? encrypt(tokens.refresh_token, env.ENCRYPTION_KEY)
        : null;

    const expiresAt = new Date(Date.now() + tokens.access_token_expire_in * 1000);

    await prisma.tiktokShop.update({
        where: { id: shopDbId },
        data: {
            access_token_enc: accessTokenEnc,
            refresh_token_enc: refreshTokenEnc ?? shop.refresh_token_enc,
            token_expires_at: expiresAt,
            status: 'ACTIVE',
        },
    });

    await prisma.tiktokSyncLog.create({
        data: {
            tenant_id: tenantId,
            shop_id_ref: shopDbId,
            sync_type: 'TOKEN_REFRESH',
            status: 'SUCCESS',
        },
    });

    logger.info('TikTok Shop token refreshed', { tiktokShopId: shopDbId, tenantId, traceId });
    return { refreshed: true };
}

export async function listTikTokShops(tenantId: string) {
    return prisma.tiktokShop.findMany({
        where: { tenant_id: tenantId },
        select: {
            id: true,
            shop_id: true,
            shop_name: true,
            region: true,
            status: true,
            token_expires_at: true,
            created_at: true,
        },
        orderBy: { created_at: 'desc' },
    });
}

export async function getTikTokShopDecryptedToken(shopDbId: string, tenantId: string): Promise<string> {
    const shop = await prisma.tiktokShop.findFirst({
        where: { id: shopDbId, tenant_id: tenantId },
    });
    if (!shop) throw new Error('TikTok shop not found');
    return decrypt(shop.access_token_enc, env.ENCRYPTION_KEY);
}
