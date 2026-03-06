import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { signAccessToken } from '../../lib/jwt';
import { generateRefreshToken, hashToken } from '../../lib/crypto';
import { logger } from '../../lib/logger';

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export class AuthError extends Error {
    public statusCode: number;
    constructor(message: string, statusCode = 401) {
        super(message);
        this.name = 'AuthError';
        this.statusCode = statusCode;
    }
}

export async function loginUser(email: string, password: string, traceId: string) {
    const user = await prisma.user.findFirst({
        where: { email },
        include: { tenant: true },
    });

    if (!user) {
        throw new AuthError('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
        throw new AuthError('Invalid credentials');
    }

    const accessToken = signAccessToken({
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role,
    });

    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
        data: {
            user_id: user.id,
            token_hash: tokenHash,
            expires_at: expiresAt,
        },
    });

    await prisma.auditLog.create({
        data: {
            tenant_id: user.tenant_id,
            actor_user_id: user.id,
            entity: 'session',
            entity_id: user.id,
            action: 'login',
        },
    });

    logger.info('User logged in', { traceId, tenantId: user.tenant_id, userId: user.id });

    return {
        accessToken,
        refreshToken: rawRefreshToken,
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
            tenant: {
                id: user.tenant.id,
                name: user.tenant.name,
                plan: user.tenant.plan,
            },
        },
    };
}

export async function refreshAccessToken(rawRefreshToken: string, traceId: string) {
    const tokenHash = hashToken(rawRefreshToken);

    const storedToken = await prisma.refreshToken.findFirst({
        where: {
            token_hash: tokenHash,
            revoked_at: null,
            expires_at: { gt: new Date() },
        },
        include: {
            user: { include: { tenant: true } },
        },
    });

    if (!storedToken) {
        throw new AuthError('Invalid or expired refresh token');
    }

    // Revoke old token (rotation)
    await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked_at: new Date() },
    });

    const user = storedToken.user;
    const accessToken = signAccessToken({
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role,
    });

    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
        data: {
            user_id: user.id,
            token_hash: newTokenHash,
            expires_at: expiresAt,
        },
    });

    logger.info('Token refreshed', { traceId, tenantId: user.tenant_id, userId: user.id });

    return { accessToken, refreshToken: newRawRefreshToken };
}

export async function logoutUser(
    rawRefreshToken: string,
    userId: string,
    tenantId: string,
    traceId: string,
) {
    const tokenHash = hashToken(rawRefreshToken);

    const result = await prisma.refreshToken.updateMany({
        where: {
            token_hash: tokenHash,
            user_id: userId,
            revoked_at: null,
        },
        data: { revoked_at: new Date() },
    });

    if (result.count > 0) {
        await prisma.auditLog.create({
            data: {
                tenant_id: tenantId,
                actor_user_id: userId,
                entity: 'session',
                entity_id: userId,
                action: 'logout',
            },
        });

        logger.info('User logged out', { traceId, tenantId, userId });
    }
}

export async function getCurrentUser(userId: string, tenantId: string) {
    const user = await prisma.user.findFirst({
        where: { id: userId, tenant_id: tenantId },
        include: { tenant: true },
    });

    if (!user) {
        throw new AuthError('User not found', 404);
    }

    return {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.created_at.toISOString(),
        tenant: {
            id: user.tenant.id,
            name: user.tenant.name,
            plan: user.tenant.plan,
        },
    };
}
