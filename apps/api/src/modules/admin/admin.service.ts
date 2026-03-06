import { prisma } from '../../lib/prisma';

export async function getTenantById(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
    });

    if (!tenant) {
        return null;
    }

    return {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan,
        createdAt: tenant.created_at.toISOString(),
    };
}
