'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface ProductRow {
    id: string;
    title: string;
    sku: string | null;
    price: string;
    compare_at_price: string | null;
    inventory_qty: number;
    image_url: string | null;
    shopify_product_id: string | null;
    shopify_sync_status: string;
    shopify_synced_at: string | null;
    status: string;
    created_at: string;
}

export default function ProductsPage() {
    const [products, setProducts] = useState<ProductRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        title: '', description: '', sku: '', price: '', compare_at_price: '',
        inventory_qty: '0', vendor: '', product_type: '', tags: '', image_url: '',
        auto_sync: true,
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => { loadProducts(); }, []);

    const loadProducts = async () => {
        try {
            const data = await apiFetch<ProductRow[]>('/products');
            setProducts(data);
        } catch { }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.price) return;
        setSaving(true);
        setMessage('');
        try {
            await apiFetch('/products', {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    inventory_qty: parseInt(formData.inventory_qty) || 0,
                }),
            });
            setMessage('✅ Produto criado com sucesso!');
            setShowForm(false);
            setFormData({
                title: '', description: '', sku: '', price: '', compare_at_price: '',
                inventory_qty: '0', vendor: '', product_type: '', tags: '', image_url: '',
                auto_sync: true,
            });
            loadProducts();
        } catch (err) {
            setMessage(`❌ Erro ao criar produto: ${err instanceof Error ? err.message : 'Desconhecido'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSync = async (id: string) => {
        setSyncing(id);
        setMessage('');
        try {
            await apiFetch(`/products/${id}/sync-shopify`, { method: 'POST' });
            setMessage('✅ Produto sincronizado com a Shopify!');
            loadProducts();
        } catch (err) {
            setMessage(`❌ Falha na sincronização: ${err instanceof Error ? err.message : 'Desconhecido'}`);
        } finally {
            setSyncing(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este produto? Ele também será removido da Shopify.')) return;
        try {
            await apiFetch(`/products/${id}`, { method: 'DELETE' });
            setMessage('✅ Produto excluído');
            loadProducts();
        } catch {
            setMessage('❌ Erro ao excluir');
        }
    };

    const syncColor = (s: string) => {
        if (s === 'SYNCED') return 'bg-emerald-500/10 text-emerald-400';
        if (s === 'ERROR') return 'bg-red-500/10 text-red-400';
        return 'bg-white/5 text-white/40';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-white">📦 Produtos</h1>
                    <p className="text-white/40 mt-1">Cadastre produtos e publique automaticamente na Shopify</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} className="btn-primary">
                    {showForm ? 'Cancelar' : '+ Novo Produto'}
                </button>
            </div>

            {message && (
                <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm">
                    {message}
                </div>
            )}

            {/* Create Product Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="card space-y-4">
                    <h2 className="text-lg font-semibold text-white">Novo Produto</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-white/40 mb-1">Título *</label>
                            <input type="text" value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="input-field w-full" placeholder="Nome do produto" required />
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1">SKU</label>
                            <input type="text" value={formData.sku}
                                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                className="input-field w-full" placeholder="SKU-001" />
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1">Preço *</label>
                            <input type="text" value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                className="input-field w-full" placeholder="29.90" required />
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1">Preço Comparativo</label>
                            <input type="text" value={formData.compare_at_price}
                                onChange={(e) => setFormData({ ...formData, compare_at_price: e.target.value })}
                                className="input-field w-full" placeholder="49.90" />
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1">Estoque</label>
                            <input type="number" value={formData.inventory_qty}
                                onChange={(e) => setFormData({ ...formData, inventory_qty: e.target.value })}
                                className="input-field w-full" />
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1">Fornecedor</label>
                            <input type="text" value={formData.vendor}
                                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                                className="input-field w-full" placeholder="VTVariaty" />
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1">Tipo de Produto</label>
                            <input type="text" value={formData.product_type}
                                onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                                className="input-field w-full" placeholder="Acessório" />
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1">Tags</label>
                            <input type="text" value={formData.tags}
                                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                className="input-field w-full" placeholder="promoção, novo" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs text-white/40 mb-1">URL da Imagem</label>
                            <input type="text" value={formData.image_url}
                                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                className="input-field w-full" placeholder="https://..." />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs text-white/40 mb-1">Descrição</label>
                            <textarea value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="input-field w-full h-24" placeholder="Descrição do produto..." />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                        <label className="flex items-center gap-2 text-sm text-white/60">
                            <input type="checkbox" checked={formData.auto_sync}
                                onChange={(e) => setFormData({ ...formData, auto_sync: e.target.checked })}
                                className="rounded" />
                            🛍️ Publicar automaticamente na Shopify
                        </label>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button type="submit" disabled={saving} className="btn-primary">
                            {saving ? 'Salvando...' : '💾 Salvar Produto'}
                        </button>
                    </div>
                </form>
            )}

            {/* Products Table */}
            <div className="card">
                {loading ? <p className="text-white/30 text-sm">Carregando...</p> : products.length === 0 ? (
                    <p className="text-white/30 text-sm">Nenhum produto cadastrado ainda. Clique em &quot;+ Novo Produto&quot; para começar!</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Produto</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">SKU</th>
                                    <th className="text-right py-3 px-2 text-white/40 font-medium">Preço</th>
                                    <th className="text-center py-3 px-2 text-white/40 font-medium">Estoque</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Shopify</th>
                                    <th className="text-right py-3 px-2 text-white/40 font-medium">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((p) => (
                                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                        <td className="py-3 px-2">
                                            <div className="flex items-center gap-3">
                                                {p.image_url && (
                                                    <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                                )}
                                                <span className="text-white font-medium text-sm">{p.title}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-2 text-white/50 font-mono text-xs">{p.sku || '—'}</td>
                                        <td className="py-3 px-2 text-right text-white font-mono text-xs">
                                            R$ {Number(p.price).toFixed(2)}
                                        </td>
                                        <td className="py-3 px-2 text-center text-white/50 text-xs">{p.inventory_qty}</td>
                                        <td className="py-3 px-2">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${syncColor(p.shopify_sync_status)}`}>
                                                {p.shopify_sync_status === 'SYNCED' ? '✅ Sincronizado' : '⏳ Não Sincronizado'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-right space-x-3">
                                            {p.shopify_sync_status !== 'SYNCED' && (
                                                <button onClick={() => handleSync(p.id)} disabled={syncing === p.id}
                                                    className="text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50">
                                                    {syncing === p.id ? 'Sincronizando...' : '🛍️ Sync Shopify'}
                                                </button>
                                            )}
                                            {p.shopify_sync_status === 'SYNCED' && (
                                                <button onClick={() => handleSync(p.id)} disabled={syncing === p.id}
                                                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50">
                                                    {syncing === p.id ? 'Atualizando...' : '🔄 Atualizar'}
                                                </button>
                                            )}
                                            <button onClick={() => handleDelete(p.id)}
                                                className="text-xs text-red-400 hover:text-red-300">
                                                🗑️ Excluir
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
