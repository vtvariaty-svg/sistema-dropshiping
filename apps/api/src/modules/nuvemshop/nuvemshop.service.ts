import crypto from 'crypto';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

// ─── Constants ──────────────────────────────────────────────────
const NUVEMSHOP_API_BASE = 'https://api.nuvemshop.com.br/v1';

// ─── Token Encryption ───────────────────────────────────────────
function encryptToken(token: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(env.ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

function decryptToken(hash: string): string {
    const [ivHex, encryptedHex] = hash.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(env.ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// ─── Auth / OAuth Flow ──────────────────────────────────────────
export function getInstallUrl(tenantId: string): string {
    if (!env.NUVEMSHOP_CLIENT_ID) throw new Error('NUVEMSHOP_CLIENT_ID not configured');
    
    // Sign a short-lived state token containing the tenantId
    const state = crypto.createHmac('sha256', env.JWT_ACCESS_SECRET)
        .update(`nuvemshop-auth-${tenantId}-${Date.now()}`)
        .digest('hex');
    
    // For simplicity without adding state storage, we'll just pass the tenantId if it's safe enough for this poc,
    // but better to use a JWT or a simple signed string.
    // Let's use a simple colon-separated signed string: tenantId:hash
    const hash = crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(tenantId).digest('hex');
    const signedState = `${tenantId}:${hash}`;

    return `https://www.nuvemshop.com.br/apps/${env.NUVEMSHOP_CLIENT_ID}/authorize?state=${signedState}`;
}

export function verifyState(state: string): string {
    const [tenantId, hash] = state.split(':');
    if (!tenantId || !hash) throw new Error('Invalid state');
    const expectedHash = crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(tenantId).digest('hex');
    if (hash !== expectedHash) throw new Error('State verification failed');
    return tenantId;
}

export async function authorizeCallback(code: string, tenantId: string) {
    if (!env.NUVEMSHOP_CLIENT_ID || !env.NUVEMSHOP_CLIENT_SECRET) {
        throw new Error('Nuvemshop credentials not configured');
    }

    try {
        const res = await fetch('https://www.nuvemshop.com.br/apps/authorize/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: env.NUVEMSHOP_CLIENT_ID,
                client_secret: env.NUVEMSHOP_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            logger.error('Nuvemshop OAuth failed', { status: res.status, body: err });
            throw new Error(`Nuvemshop OAuth failed: ${res.status}`);
        }

        const data = await res.json() as {
            access_token: string;
            token_type: string;
            scope: string;
            user_id: number;
        };

        const storeId = String(data.user_id);

        // Fetch store details to get the name
        const storeRes = await fetch(`${NUVEMSHOP_API_BASE}/${storeId}/store`, {
            headers: {
                'Authentication': `bearer ${data.access_token}`,
                'User-Agent': `Dropship SaaS (${env.WEB_BASE_URL})`,
            },
        });
        
        let storeName = `Loja ${storeId}`;
        if (storeRes.ok) {
            const storeData = await storeRes.json() as { name: { pt?: string; es?: string }; original_domain: string };
            storeName = storeData.name?.pt || storeData.name?.es || storeData.original_domain || storeName;
        }

        // Save or update store in DB
        const existing = await prisma.nuvemshopStore.findFirst({
            where: { tenant_id: tenantId, store_id: storeId },
        });

        const store = existing 
            ? await prisma.nuvemshopStore.update({
                where: { id: existing.id },
                data: { access_token_enc: encryptToken(data.access_token), name: storeName, status: 'active' },
            })
            : await prisma.nuvemshopStore.create({
                data: {
                    tenant_id: tenantId,
                    store_id: storeId,
                    name: storeName,
                    access_token_enc: encryptToken(data.access_token),
                },
            });

        // Try to register webhooks asynchronously
        registerWebhooks(storeId, data.access_token).catch(e => {
            logger.error('Failed to register Nuvemshop webhooks', { storeId, error: e.message });
        });

        return store;
    } catch (err) {
        logger.error('Authorize callback failed', { error: err instanceof Error ? err.message : 'Unknown' });
        throw err;
    }
}

// ─── API Client ──────────────────────────────────────────────────

export async function getStoreWithToken(storeDbId: string, tenantId: string) {
    const store = await prisma.nuvemshopStore.findFirst({
        where: { id: storeDbId, tenant_id: tenantId, status: 'active' },
    });
    if (!store) return null;
    return {
        ...store,
        accessToken: decryptToken(store.access_token_enc),
    };
}

export async function nuvemshopApiFetch<T>(storeId: string, accessToken: string, path: string, options?: RequestInit): Promise<T> {
    const url = `${NUVEMSHOP_API_BASE}/${storeId}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Authentication': `bearer ${accessToken}`,
            'User-Agent': `Dropship SaaS (${env.WEB_BASE_URL})`,
            'Content-Type': 'application/json',
            ...(options?.headers || {}),
        },
    });

    if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Nuvemshop API Error: [${res.status}] ${errorBody}`);
    }

    if (res.status === 204) return {} as T;
    return res.json() as T;
}

// ─── Webhook Registration ────────────────────────────────────────

const REQUIRED_WEBHOOKS = [
    { event: 'order/created', topic: 'orders/created' },
    { event: 'order/paid', topic: 'orders/paid' },
    { event: 'app/uninstalled', topic: 'app/uninstalled' },
];

export async function registerWebhooks(storeId: string, accessToken: string) {
    const webhookUrl = `${env.APP_BASE_URL}/webhooks/nuvemshop`;
    
    // Get existing webhooks
    type WebhookData = { id: number; event: string; url: string };
    const existing = await nuvemshopApiFetch<WebhookData[]>(storeId, accessToken, '/webhooks');
    
    for (const hw of REQUIRED_WEBHOOKS) {
        const isRegistered = existing.some(w => w.event === hw.event && w.url === webhookUrl);
        if (!isRegistered) {
            await nuvemshopApiFetch(storeId, accessToken, '/webhooks', {
                method: 'POST',
                body: JSON.stringify({
                    event: hw.event,
                    url: webhookUrl,
                }),
            });
            logger.info('Registered Nuvemshop webhook', { storeId, event: hw.event });
        }
    }
}
