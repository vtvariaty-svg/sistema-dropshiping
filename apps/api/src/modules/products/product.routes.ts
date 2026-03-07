import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/authenticate';
import {
    createProduct, updateProduct, deleteProduct,
    listProducts, getProduct, syncProductToShopify,
} from './product.service';

export async function productRoutes(fastify: FastifyInstance) {

    // GET /products
    fastify.get('/products', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const products = await listProducts(request.currentUser!.tenantId);
        return reply.send(products);
    });

    // GET /products/:id
    fastify.get('/products/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const product = await getProduct(id, request.currentUser!.tenantId);
        if (!product) return reply.code(404).send({ error: 'Product not found' });
        return reply.send(product);
    });

    // POST /products
    fastify.post('/products', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as {
            title: string; description?: string; vendor?: string;
            product_type?: string; tags?: string; sku?: string;
            price: string; compare_at_price?: string;
            inventory_qty?: number; image_url?: string;
            auto_sync?: boolean;
        };
        if (!body.title || !body.price) {
            return reply.code(400).send({ error: 'Title and price are required' });
        }

        // Sanitize prices (replace comma with dot, handle empty strings)
        body.price = body.price.replace(',', '.');
        if (body.compare_at_price) {
            body.compare_at_price = body.compare_at_price.replace(',', '.');
        } else {
            body.compare_at_price = undefined;
        }

        const product = await createProduct(request.currentUser!.tenantId, body);
        return reply.code(201).send(product);
    });

    // PUT /products/:id
    fastify.put('/products/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const body = request.body as {
            title?: string; description?: string; vendor?: string;
            product_type?: string; tags?: string; sku?: string;
            price?: string; compare_at_price?: string;
            inventory_qty?: number; image_url?: string;
            auto_sync?: boolean;
        };

        if (body.price) body.price = body.price.replace(',', '.');
        if (body.compare_at_price) body.compare_at_price = body.compare_at_price.replace(',', '.');
        else if (body.compare_at_price === '') body.compare_at_price = undefined;

        const product = await updateProduct(id, request.currentUser!.tenantId, body);
        return reply.send(product);
    });

    // DELETE /products/:id
    fastify.delete('/products/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const result = await deleteProduct(id, request.currentUser!.tenantId);
        return reply.send(result);
    });

    // POST /products/:id/sync-shopify
    fastify.post('/products/:id/sync-shopify', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        try {
            const result = await syncProductToShopify(id, request.currentUser!.tenantId);
            return reply.send(result);
        } catch (err) {
            return reply.code(400).send({ error: err instanceof Error ? err.message : 'Sync failed' });
        }
    });
}
