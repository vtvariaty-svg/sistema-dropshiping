import { FastifyInstance } from 'fastify';
import { loginSchema } from '@dropship/shared';
import {
    loginUser,
    refreshAccessToken,
    logoutUser,
    getCurrentUser,
    AuthError,
} from './auth.service';
import { authenticate } from '../../middleware/authenticate';

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function getCookieOptions() {
    return {
        httpOnly: true,
        secure: true,
        sameSite: 'none' as const,
        path: '/',
    };
}

export async function authRoutes(fastify: FastifyInstance) {
    // POST /auth/login
    fastify.post('/auth/login', async (request, reply) => {
        const parsed = loginSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({
                error: 'Validation failed',
                details: parsed.error.flatten().fieldErrors,
            });
        }

        try {
            const result = await loginUser(parsed.data.email, parsed.data.password, request.traceId);

            reply.setCookie(REFRESH_COOKIE_NAME, result.refreshToken, {
                ...getCookieOptions(),
                maxAge: REFRESH_COOKIE_MAX_AGE,
            });

            return reply.code(200).send({
                accessToken: result.accessToken,
                user: result.user,
            });
        } catch (err) {
            if (err instanceof AuthError) {
                return reply.code(err.statusCode).send({ error: err.message });
            }
            throw err;
        }
    });

    // POST /auth/refresh
    fastify.post('/auth/refresh', async (request, reply) => {
        const rawRefreshToken = request.cookies[REFRESH_COOKIE_NAME];
        if (!rawRefreshToken) {
            return reply.code(401).send({ error: 'No refresh token provided' });
        }

        try {
            const result = await refreshAccessToken(rawRefreshToken, request.traceId);

            reply.setCookie(REFRESH_COOKIE_NAME, result.refreshToken, {
                ...getCookieOptions(),
                maxAge: REFRESH_COOKIE_MAX_AGE,
            });

            return reply.code(200).send({ accessToken: result.accessToken });
        } catch (err) {
            if (err instanceof AuthError) {
                return reply.code(err.statusCode).send({ error: err.message });
            }
            throw err;
        }
    });

    // POST /auth/logout (authenticated)
    fastify.post(
        '/auth/logout',
        { preHandler: [authenticate] },
        async (request, reply) => {
            const rawRefreshToken = request.cookies[REFRESH_COOKIE_NAME];
            const user = request.currentUser!;

            if (rawRefreshToken) {
                await logoutUser(rawRefreshToken, user.userId, user.tenantId, request.traceId);
            }

            reply.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions());

            return reply.code(200).send({ message: 'Logged out' });
        },
    );

    // GET /me (authenticated)
    fastify.get(
        '/me',
        { preHandler: [authenticate] },
        async (request, reply) => {
            const user = request.currentUser!;

            try {
                const me = await getCurrentUser(user.userId, user.tenantId);
                return reply.code(200).send(me);
            } catch (err) {
                if (err instanceof AuthError) {
                    return reply.code(err.statusCode).send({ error: err.message });
                }
                throw err;
            }
        },
    );
}
