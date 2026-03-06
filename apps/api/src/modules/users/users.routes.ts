import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/require-role';
import * as usersService from './users.service';
import { logger } from '../../lib/logger';

export async function userRoutes(fastify: FastifyInstance) {
    // List users
    fastify.get(
        '/users',
        { preHandler: [authenticate, requireRole(['admin'])] },
        async (request, reply) => {
            const user = request.currentUser!;
            const users = await usersService.getUsers(user.tenantId);
            return reply.send(users);
        }
    );

    // Create user
    fastify.post(
        '/users',
        { preHandler: [authenticate, requireRole(['admin'])] },
        async (request, reply) => {
            const user = request.currentUser!;

            const schema = z.object({
                email: z.string().email(),
                password: z.string().min(6),
                role: z.enum(['admin', 'operator']),
            });

            const parsed = schema.safeParse(request.body);
            if (!parsed.success) {
                return reply.code(400).send({ error: 'Invalid data', details: parsed.error.issues });
            }

            try {
                const newUser = await usersService.createUser(user.tenantId, parsed.data);
                
                logger.info('User created', {
                    traceId: request.traceId,
                    tenantId: user.tenantId,
                    adminEmail: user.email,
                    newUserEmail: newUser.email,
                });

                return reply.code(201).send(newUser);
            } catch (err: any) {
                return reply.code(400).send({ error: err.message });
            }
        }
    );

    // Delete user
    fastify.delete(
        '/users/:id',
        { preHandler: [authenticate, requireRole(['admin'])] },
        async (request, reply) => {
            const user = request.currentUser!;
            const { id } = request.params as { id: string };

            if (user.id === id) {
                return reply.code(400).send({ error: 'Cannot delete yourself' });
            }

            try {
                await usersService.deleteUser(user.tenantId, id);
                
                logger.info('User deleted', {
                    traceId: request.traceId,
                    tenantId: user.tenantId,
                    adminEmail: user.email,
                    deletedUserId: id,
                });

                return reply.code(204).send();
            } catch (err) {
                return reply.code(400).send({ error: 'Failed to delete user' });
            }
        }
    );
}
