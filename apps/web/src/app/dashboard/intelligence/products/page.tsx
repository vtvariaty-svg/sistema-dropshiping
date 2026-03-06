'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Product {
    id: string; name_raw: string; category: string | null; created_at: string;
    cluster_links: Array<{ cluster: { id: string; name_norm: string } }>;
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name_raw: '', category: '' });
    const [editId, setEditId] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    useEffect(() => { load(); }, []);
    const load = async () => { try { setProducts(await apiFetch('/products')); } catch { } finally { setLoading(false); } };

    const handleSubmit = async () => {
        setMessage('');
        try {
            const body = { name_raw: form.name_raw, category: form.category || null };
            if (editId) { await apiFetch(`/products/${editId}`, { method: 'PUT', body: JSON.stringify(body) }); }
            else { await apiFetch('/products', { method: 'POST', body: JSON.stringify(body) }); }
            setForm({ name_raw: '', category: '' }); setEditId(null); load();
        } catch (e) { setMessage(`Failed: ${e}`); }
    };

    const startEdit = (p: Product) => { setEditId(p.id); setForm({ name_raw: p.name_raw, category: p.category ?? '' }); };
    const handleDelete = async (id: string) => { try { await apiFetch(`/products/${id}`, { method: 'DELETE' }); load(); } catch { } };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Produtos</h1>
                <p className="text-white/40 mt-1">Registre produtos para análise de inteligência</p>
            </div>

            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">{editId ? 'Editar Produto' : 'Novo Produto'}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input className="input-field" placeholder="Nome do Produto" value={form.name_raw} onChange={(e) => setForm({ ...form, name_raw: e.target.value })} />
                    <input className="input-field" placeholder="Categoria (opcional)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                    <button onClick={handleSubmit} className="btn-primary text-sm">{editId ? 'Atualizar' : 'Criar'}</button>
                </div>
                {message && <p className="text-red-400 text-sm mt-2">{message}</p>}
            </div>

            <div className="card">
                {loading ? <p className="text-white/30 text-sm">Carregando...</p> : products.length === 0 ? <p className="text-white/30 text-sm">Nenhum produto registrado.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/10">
                                <th className="text-left py-3 px-2 text-white/40">Nome</th>
                                <th className="text-left py-3 px-2 text-white/40">Categoria</th>
                                <th className="text-left py-3 px-2 text-white/40">Cluster</th>
                                <th className="text-left py-3 px-2 text-white/40">Criado Em</th>
                                <th className="text-right py-3 px-2 text-white/40"></th>
                            </tr></thead>
                            <tbody>{products.map((p) => (
                                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-2 text-white font-medium">{p.name_raw}</td>
                                    <td className="py-3 px-2 text-white/50">{p.category ?? '—'}</td>
                                    <td className="py-3 px-2 text-white/40 text-xs">{p.cluster_links[0]?.cluster?.name_norm ?? '—'}</td>
                                    <td className="py-3 px-2 text-white/30 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                                    <td className="py-3 px-2 text-right space-x-2">
                                        <button onClick={() => startEdit(p)} className="text-xs text-brand-400 hover:text-brand-300">Editar</button>
                                        <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 hover:text-red-300">Excluir</button>
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
