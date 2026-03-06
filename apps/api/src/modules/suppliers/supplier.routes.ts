import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
    listSuppliers, getSupplier, createSupplierRaw, updateSupplier, deleteSupplier,
    listProducts, getProduct, createProductRaw, updateProduct, deleteProduct,
    listMappings, getMapping, createMappingRaw, updateMapping, deleteMapping,
} from './supplier.service';
import { createSupplierSchema, updateSupplierSchema, createProductSchema, updateProductSchema, createMappingSchema, updateMappingSchema } from './supplier.schemas';
import { reconcileOrderMappingStatus } from '../../services/reconciliation';

export async function supplierRoutes(fastify: FastifyInstance) {
    // ─── Suppliers ─────────────────────────────
    fastify.get('/suppliers', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        return reply.send(await listSuppliers(req.currentUser!.tenantId));
    });
    fastify.get('/suppliers/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const s = await getSupplier((req.params as { id: string }).id, req.currentUser!.tenantId);
        return s ? reply.send(s) : reply.code(404).send({ error: 'Not found' });
    });
    fastify.post('/suppliers', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = createSupplierSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
        return reply.code(201).send(await createSupplierRaw(req.currentUser!.tenantId, parsed.data));
    });
    fastify.put('/suppliers/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = updateSupplierSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'Validation failed' });
        const result = await updateSupplier((req.params as { id: string }).id, req.currentUser!.tenantId, parsed.data);
        return result ? reply.send(result) : reply.code(404).send({ error: 'Not found' });
    });
    fastify.delete('/suppliers/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await deleteSupplier((req.params as { id: string }).id, req.currentUser!.tenantId);
            return result ? reply.send({ deleted: true }) : reply.code(404).send({ error: 'Not found' });
        } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Delete failed' }); }
    });

    // ─── Supplier Products ─────────────────────
    fastify.get('/supplier-products', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const q = req.query as { supplier_id?: string; active?: string };
        return reply.send(await listProducts(req.currentUser!.tenantId, q.supplier_id, q.active === 'true' ? true : q.active === 'false' ? false : undefined));
    });
    fastify.get('/supplier-products/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const p = await getProduct((req.params as { id: string }).id, req.currentUser!.tenantId);
        return p ? reply.send(p) : reply.code(404).send({ error: 'Not found' });
    });
    fastify.post('/supplier-products', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = createProductSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
        return reply.code(201).send(await createProductRaw(req.currentUser!.tenantId, parsed.data));
    });
    fastify.put('/supplier-products/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = updateProductSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'Validation failed' });
        const result = await updateProduct((req.params as { id: string }).id, req.currentUser!.tenantId, parsed.data);
        return result ? reply.send(result) : reply.code(404).send({ error: 'Not found' });
    });
    fastify.delete('/supplier-products/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await deleteProduct((req.params as { id: string }).id, req.currentUser!.tenantId);
            return result ? reply.send({ deleted: true }) : reply.code(404).send({ error: 'Not found' });
        } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Delete failed' }); }
    });

    // ─── SKU Mappings ──────────────────────────
    fastify.get('/sku-mappings', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const q = req.query as { supplier_id?: string; store_id?: string };
        return reply.send(await listMappings(req.currentUser!.tenantId, q.supplier_id, q.store_id));
    });
    fastify.get('/sku-mappings/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const m = await getMapping((req.params as { id: string }).id, req.currentUser!.tenantId);
        return m ? reply.send(m) : reply.code(404).send({ error: 'Not found' });
    });
    fastify.post('/sku-mappings', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = createMappingSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
        return reply.code(201).send(await createMappingRaw(req.currentUser!.tenantId, parsed.data));
    });
    fastify.put('/sku-mappings/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const parsed = updateMappingSchema.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'Validation failed' });
        const result = await updateMapping((req.params as { id: string }).id, req.currentUser!.tenantId, parsed.data);
        return result ? reply.send(result) : reply.code(404).send({ error: 'Not found' });
    });
    fastify.delete('/sku-mappings/:id', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const result = await deleteMapping((req.params as { id: string }).id, req.currentUser!.tenantId);
        return result ? reply.send({ deleted: true }) : reply.code(404).send({ error: 'Not found' });
    });

    // ─── Order Reconciliation ──────────────────
    fastify.post('/orders/:id/reconcile-mapping', { preHandler: [authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        const status = await reconcileOrderMappingStatus((req.params as { id: string }).id, req.currentUser!.tenantId);
        return status ? reply.send({ operational_status: status }) : reply.code(404).send({ error: 'Order not found' });
    });
}
