import crypto from 'node:crypto';
import { env } from '../../../config/env';
import { logger } from '../../../lib/logger';

/**
 * TikTok Shop API Client — handles signed HTTP requests to the Open API.
 * Isolates all TikTok-specific HTTP logic in one place.
 */

function generateSign(path: string, params: Record<string, string>, body: string, appSecret: string): string {
    const sortedKeys = Object.keys(params).sort();
    let baseString = appSecret + path;
    for (const key of sortedKeys) {
        baseString += key + params[key];
    }
    baseString += body + appSecret;
    return crypto.createHmac('sha256', appSecret).update(baseString).digest('hex');
}

function buildTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
}

export interface TikTokApiResponse<T = unknown> {
    code: number;
    message: string;
    data: T;
    request_id?: string;
}

export async function tiktokApiRequest<T = unknown>(opts: {
    path: string;
    method?: string;
    accessToken: string;
    body?: Record<string, unknown>;
    queryParams?: Record<string, string>;
}): Promise<TikTokApiResponse<T>> {
    const appKey = env.TIKTOK_SHOP_APP_KEY;
    const appSecret = env.TIKTOK_SHOP_APP_SECRET;
    const baseUrl = env.TIKTOK_SHOP_API_BASE_URL;

    const timestamp = buildTimestamp();
    const params: Record<string, string> = {
        app_key: appKey,
        timestamp,
        access_token: opts.accessToken,
        ...opts.queryParams,
    };

    const bodyStr = opts.body ? JSON.stringify(opts.body) : '';
    const sign = generateSign(opts.path, params, bodyStr, appSecret);
    params.sign = sign;

    const qs = new URLSearchParams(params).toString();
    const url = `${baseUrl}${opts.path}?${qs}`;

    const response = await fetch(url, {
        method: opts.method ?? 'GET',
        headers: {
            'Content-Type': 'application/json',
            'x-tts-access-token': opts.accessToken,
        },
        body: opts.method === 'POST' || opts.method === 'PUT' ? bodyStr || undefined : undefined,
    });

    if (!response.ok) {
        const text = await response.text();
        logger.error('TikTok API HTTP error', { status: response.status, body: text, path: opts.path });
        throw new Error(`TikTok API returned ${response.status}: ${text}`);
    }

    return response.json() as Promise<TikTokApiResponse<T>>;
}

// ─── Auth Endpoints ──────────────────────────────────────────────

export async function exchangeCodeForToken(authCode: string): Promise<{
    access_token: string;
    refresh_token: string;
    access_token_expire_in: number;
    refresh_token_expire_in: number;
}> {
    const appKey = env.TIKTOK_SHOP_APP_KEY;
    const appSecret = env.TIKTOK_SHOP_APP_SECRET;
    const baseUrl = env.TIKTOK_SHOP_API_BASE_URL;

    const url = `${baseUrl}/api/v2/token/get?app_key=${appKey}&app_secret=${appSecret}&auth_code=${authCode}&grant_type=authorized_code`;

    const response = await fetch(url, { method: 'GET' });
    const json = await response.json() as TikTokApiResponse<{
        access_token: string;
        refresh_token: string;
        access_token_expire_in: number;
        refresh_token_expire_in: number;
    }>;

    if (json.code !== 0) {
        throw new Error(`TikTok token exchange failed: ${json.message}`);
    }

    return json.data;
}

export async function refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    access_token_expire_in: number;
    refresh_token_expire_in: number;
}> {
    const appKey = env.TIKTOK_SHOP_APP_KEY;
    const appSecret = env.TIKTOK_SHOP_APP_SECRET;
    const baseUrl = env.TIKTOK_SHOP_API_BASE_URL;

    const url = `${baseUrl}/api/v2/token/refresh?app_key=${appKey}&app_secret=${appSecret}&refresh_token=${refreshToken}&grant_type=refresh_token`;

    const response = await fetch(url, { method: 'GET' });
    const json = await response.json() as TikTokApiResponse<{
        access_token: string;
        refresh_token: string;
        access_token_expire_in: number;
        refresh_token_expire_in: number;
    }>;

    if (json.code !== 0) {
        throw new Error(`TikTok token refresh failed: ${json.message}`);
    }

    return json.data;
}

// ─── Order Endpoints ─────────────────────────────────────────────

export async function fetchTikTokOrder(accessToken: string, orderId: string) {
    const result = await tiktokApiRequest<{ order_list: Record<string, unknown>[] }>({
        path: '/api/orders/detail/query',
        method: 'POST',
        accessToken,
        body: { order_id_list: [orderId] },
    });
    if (result.code !== 0) {
        throw new Error(`TikTok order fetch failed: ${result.message}`);
    }
    const orders = result.data?.order_list ?? [];
    if (orders.length === 0) throw new Error(`TikTok order ${orderId} not found`);
    return orders[0];
}

export async function fetchTikTokOrderList(accessToken: string, params?: {
    page_size?: number;
    cursor?: string;
    create_time_from?: number;
    create_time_to?: number;
}) {
    return tiktokApiRequest<{ order_list: Record<string, unknown>[]; next_cursor: string; more: boolean }>({
        path: '/api/orders/search',
        method: 'POST',
        accessToken,
        body: {
            page_size: params?.page_size ?? 50,
            cursor: params?.cursor ?? '',
            ...(params?.create_time_from ? { create_time_from: params.create_time_from } : {}),
            ...(params?.create_time_to ? { create_time_to: params.create_time_to } : {}),
        },
    });
}
