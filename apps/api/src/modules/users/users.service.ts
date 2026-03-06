import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function getUsers(tenantId: string) {
    return prisma.user.findMany({
        where: { tenant_id: tenantId },
        select: {
            id: true,
            email: true,
            role: true,
            created_at: true,
        },
        orderBy: { created_at: 'desc' },
    });
}

export async function createUser(tenantId: string, data: any) {
    const existing = await prisma.user.findUnique({
        where: {
            tenant_id_email: {
                tenant_id: tenantId,
                email: data.email,
            },
        },
    });

    if (existing) {
        throw new Error('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    return prisma.user.create({
        data: {
            tenant_id: tenantId,
            email: data.email,
            password_hash: passwordHash,
            role: data.role,
        },
        select: {
            id: true,
            email: true,
            role: true,
            created_at: true,
        },
    });
}

export async function deleteUser(tenantId: string, userId: string) {
    // Basic protection: prevent deleting the last admin, etc., if desired.
    return prisma.user.delete({
        where: {
            id: userId,
            tenant_id: tenantId,
        },
    });
}
