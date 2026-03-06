import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    const tenant = await prisma.tenant.upsert({
        where: { id: '00000000-0000-0000-0000-000000000001' },
        update: {},
        create: {
            id: '00000000-0000-0000-0000-000000000001',
            name: 'Demo Tenant',
            plan: 'pro',
        },
    });
    console.log(`✅ Tenant created: ${tenant.name}`);

    const passwordHash = await bcrypt.hash('admin123', 12);

    const admin = await prisma.user.upsert({
        where: {
            tenant_id_email: {
                tenant_id: tenant.id,
                email: 'admin@demo.com',
            },
        },
        update: {},
        create: {
            tenant_id: tenant.id,
            email: 'admin@demo.com',
            password_hash: passwordHash,
            role: 'admin',
        },
    });
    console.log(`✅ Admin user created: ${admin.email}`);

    const operator = await prisma.user.upsert({
        where: {
            tenant_id_email: {
                tenant_id: tenant.id,
                email: 'operator@demo.com',
            },
        },
        update: {},
        create: {
            tenant_id: tenant.id,
            email: 'operator@demo.com',
            password_hash: await bcrypt.hash('operator123', 12),
            role: 'operator',
        },
    });
    console.log(`✅ Operator user created: ${operator.email}`);

    console.log('🌱 Seed complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
