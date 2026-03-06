'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Product {
    id: string; supplier_id: string; supplier_sku: string; name: string;
    cost: string; currency: string; active: boolean; created_at: string;
    supplier: { name: string };
}
interface Supplier { id: string; name: string; }

export default function SupplierProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ supplier_id: '', supplier_sku: '', name: '', cost: 0, currency: 'USD', source_url: '' });

    useEffect(() => { load(); loadSuppliers(); }, [filter]);
    const load = async () => { setLoading(true); try { const q = filter ? `?supplier_id=${filter}` : ''; setProducts(await apiFetch(`/supplier-products${q}`)); } catch { } finally { setLoading(false); } };
    const loadSuppliers = async () => { try { setSuppliers(await apiFetch('/suppliers')); } catch { } };

    const resetForm = () => { setForm({ supplier_id: '', supplier_sku: '', name: '', cost: 0, currency: 'USD', source_url: '' }); setEditId(null); setShowForm(false); };

    const handleSave = async () => {
        try {
            if (editId) { await apiFetch(`/supplier-products/${editId}`, { method: 'PUT', body: JSON.stringify(form) }); }
            else { await apiFetch('/supplier-products', { method: 'POST', body: JSON.stringify(form) }); }
            resetForm(); load();
        } catch { }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this product?')) return;
        try { await apiFetch(`/supplier-products/${id}`, { method: 'DELETE' }); load(); } catch { }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h1 className="text-2xl lg:text-3xl font-bold text-white">Supplier Products</h1>
                    <p className="text-white/40 mt-1">Products available from your suppliers</p></div>
                <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm">+ Add Product</button>
            </div>

            <div className="flex gap-3">
                <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-field w-auto text-sm">
                    <option value="">All Suppliers</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {showForm && (
                <div className="card space-y-4">
                    <h2 className="text-lg font-semibold text-white">{editId ? 'Edit' : 'New'} Product</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select className="input-field" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                            <option value="">Select Supplier *</option>
                            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <input className="input-field" placeholder="Supplier SKU *" value={form.supplier_sku} onChange={(e) => setForm({ ...form, supplier_sku: e.target.value })} />
                        <input className="input-field" placeholder="Product Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        <input className="input-field" type="number" step="0.01" placeholder="Cost *" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
                        <input className="input-field" placeholder="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                        <input className="input-field" placeholder="Source URL" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSave} className="btn-primary text-sm">{editId ? 'Update' : 'Create'}</button>
                        <button onClick={resetForm} className="text-sm text-white/40 hover:text-white/60">Cancel</button>
                    </div>
                </div>
            )}

            <div className="card">
                {loading ? <p className="text-white/30 text-sm">Loading...</p> : products.length === 0 ? <p className="text-white/30 text-sm">No products.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/10">
                                <th className="text-left py-3 px-2 text-white/40">Supplier</th>
                                <th className="text-left py-3 px-2 text-white/40">SKU</th>
                                <th className="text-left py-3 px-2 text-white/40">Name</th>
                                <th className="text-right py-3 px-2 text-white/40">Cost</th>
                                <th className="text-left py-3 px-2 text-white/40">Status</th>
                                <th className="text-right py-3 px-2 text-white/40">Actions</th>
                            </tr></thead>
                            <tbody>{products.map((p) => (
                                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-2 text-white/70 text-xs">{p.supplier.name}</td>
                                    <td className="py-3 px-2 text-white font-mono text-xs">{p.supplier_sku}</td>
                                    <td className="py-3 px-2 text-white text-xs">{p.name}</td>
                                    <td className="py-3 px-2 text-right text-white font-mono text-xs">{p.currency} {Number(p.cost).toFixed(2)}</td>
                                    <td className="py-3 px-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${p.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{p.active ? 'Active' : 'Inactive'}</span>
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
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
