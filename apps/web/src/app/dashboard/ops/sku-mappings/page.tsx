'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Mapping {
    id: string; channel: string; store_id: string | null; shopify_sku: string | null;
    shopify_variant_id: string | null; active: boolean; created_at: string;
    supplier: { name: string }; supplier_product: { name: string; supplier_sku: string };
}
interface Supplier { id: string; name: string; }
interface Product { id: string; name: string; supplier_sku: string; supplier_id: string; }

export default function SkuMappingsPage() {
    const [mappings, setMappings] = useState<Mapping[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterSupplier, setFilterSupplier] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ channel: 'SHOPIFY', store_id: '', shopify_sku: '', shopify_variant_id: '', supplier_id: '', supplier_product_id: '' });

    useEffect(() => { load(); loadSuppliers(); }, [filterSupplier]);
    useEffect(() => { if (form.supplier_id) loadProducts(form.supplier_id); }, [form.supplier_id]);

    const load = async () => { setLoading(true); try { const q = filterSupplier ? `?supplier_id=${filterSupplier}` : ''; setMappings(await apiFetch(`/sku-mappings${q}`)); } catch { } finally { setLoading(false); } };
    const loadSuppliers = async () => { try { setSuppliers(await apiFetch('/suppliers')); } catch { } };
    const loadProducts = async (sid: string) => { try { setProducts(await apiFetch(`/supplier-products?supplier_id=${sid}`)); } catch { } };

    const resetForm = () => { setForm({ channel: 'SHOPIFY', store_id: '', shopify_sku: '', shopify_variant_id: '', supplier_id: '', supplier_product_id: '' }); setShowForm(false); };

    const handleSave = async () => {
        try {
            const data = { ...form, store_id: form.store_id || null, shopify_sku: form.shopify_sku || null, shopify_variant_id: form.shopify_variant_id || null };
            await apiFetch('/sku-mappings', { method: 'POST', body: JSON.stringify(data) });
            resetForm(); load();
        } catch { }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este mapeamento?')) return;
        try { await apiFetch(`/sku-mappings/${id}`, { method: 'DELETE' }); load(); } catch { }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h1 className="text-2xl lg:text-3xl font-bold text-white">Mapeamento de SKUs</h1>
                    <p className="text-white/40 mt-1">Mapear SKUs da Shopify para produtos de fornecedores</p></div>
                <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm">+ Adicionar Mapeamento</button>
            </div>

            <div className="flex gap-3">
                <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)} className="input-field w-auto text-sm">
                    <option value="">Todos os Fornecedores</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {showForm && (
                <div className="card space-y-4">
                    <h2 className="text-lg font-semibold text-white">Novo Mapeamento</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input className="input-field" placeholder="SKU da Shopify" value={form.shopify_sku} onChange={(e) => setForm({ ...form, shopify_sku: e.target.value })} />
                        <input className="input-field" placeholder="ID da Variante Shopify" value={form.shopify_variant_id} onChange={(e) => setForm({ ...form, shopify_variant_id: e.target.value })} />
                        <select className="input-field" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value, supplier_product_id: '' })}>
                            <option value="">Selecione o Fornecedor *</option>
                            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select className="input-field" value={form.supplier_product_id} onChange={(e) => setForm({ ...form, supplier_product_id: e.target.value })}>
                            <option value="">Selecione o Produto *</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.supplier_sku} — {p.name}</option>)}
                        </select>
                    </div>
                    <p className="text-white/30 text-xs">Pelo menos um entre SKU da Shopify ou ID da Variante é obrigatório.</p>
                    <div className="flex gap-2">
                        <button onClick={handleSave} className="btn-primary text-sm">Criar</button>
                        <button onClick={resetForm} className="text-sm text-white/40 hover:text-white/60">Cancelar</button>
                    </div>
                </div>
            )}

            <div className="card">
                {loading ? <p className="text-white/30 text-sm">Carregando...</p> : mappings.length === 0 ? <p className="text-white/30 text-sm">Nenhum mapeamento.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/10">
                                <th className="text-left py-3 px-2 text-white/40">Canal</th>
                                <th className="text-left py-3 px-2 text-white/40">SKU da Shopify</th>
                                <th className="text-left py-3 px-2 text-white/40">ID da Variante</th>
                                <th className="text-left py-3 px-2 text-white/40">Fornecedor</th>
                                <th className="text-left py-3 px-2 text-white/40">SKU do Fornecedor</th>
                                <th className="text-left py-3 px-2 text-white/40">Status</th>
                                <th className="text-right py-3 px-2 text-white/40">Ações</th>
                            </tr></thead>
                            <tbody>{mappings.map((m) => (
                                <tr key={m.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-2 text-white/50 text-xs">{m.channel}</td>
                                    <td className="py-3 px-2 text-white font-mono text-xs">{m.shopify_sku ?? '—'}</td>
                                    <td className="py-3 px-2 text-white font-mono text-xs">{m.shopify_variant_id ?? '—'}</td>
                                    <td className="py-3 px-2 text-white/70 text-xs">{m.supplier.name}</td>
                                    <td className="py-3 px-2 text-white font-mono text-xs">{m.supplier_product.supplier_sku}</td>
                                    <td className="py-3 px-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${m.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{m.active ? 'Ativo' : 'Inativo'}</span>
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <button onClick={() => handleDelete(m.id)} className="text-xs text-red-400 hover:text-red-300">Excluir</button>
                                    </td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
