'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Supplier {
    id: string; name: string; contact_email: string | null; contact_name: string | null;
    phone: string | null; status: string; created_at: string;
}

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', contact_email: '', contact_name: '', phone: '', notes: '' });

    useEffect(() => { load(); }, []);
    const load = async () => { setLoading(true); try { setSuppliers(await apiFetch('/suppliers')); } catch { } finally { setLoading(false); } };

    const resetForm = () => { setForm({ name: '', contact_email: '', contact_name: '', phone: '', notes: '' }); setEditId(null); setShowForm(false); };

    const handleSave = async () => {
        try {
            if (editId) { await apiFetch(`/suppliers/${editId}`, { method: 'PUT', body: JSON.stringify(form) }); }
            else { await apiFetch('/suppliers', { method: 'POST', body: JSON.stringify(form) }); }
            resetForm(); load();
        } catch { }
    };

    const handleEdit = (s: Supplier) => {
        setForm({ name: s.name, contact_email: s.contact_email ?? '', contact_name: s.contact_name ?? '', phone: s.phone ?? '', notes: '' });
        setEditId(s.id); setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Excluir este fornecedor?')) return;
        try { await apiFetch(`/suppliers/${id}`, { method: 'DELETE' }); load(); } catch { }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-white">Fornecedores</h1>
                    <p className="text-white/40 mt-1">Gerenciar contatos e informações de fornecedores</p>
                </div>
                <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary text-sm">+ Adicionar Fornecedor</button>
            </div>

            {showForm && (
                <div className="card space-y-4">
                    <h2 className="text-lg font-semibold text-white">{editId ? 'Editar' : 'Novo'} Fornecedor</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input className="input-field" placeholder="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        <input className="input-field" placeholder="Email de Contato" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
                        <input className="input-field" placeholder="Nome de Contato" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                        <input className="input-field" placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <textarea className="input-field w-full" placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                    <div className="flex gap-2">
                        <button onClick={handleSave} className="btn-primary text-sm">{editId ? 'Atualizar' : 'Criar'}</button>
                        <button onClick={resetForm} className="text-sm text-white/40 hover:text-white/60">Cancelar</button>
                    </div>
                </div>
            )}

            <div className="card">
                {loading ? <p className="text-white/30 text-sm">Carregando...</p> : suppliers.length === 0 ? <p className="text-white/30 text-sm">Nenhum fornecedor.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/10">
                                <th className="text-left py-3 px-2 text-white/40">Nome</th>
                                <th className="text-left py-3 px-2 text-white/40">Email</th>
                                <th className="text-left py-3 px-2 text-white/40">Status</th>
                                <th className="text-left py-3 px-2 text-white/40">Criado Em</th>
                                <th className="text-right py-3 px-2 text-white/40">Ações</th>
                            </tr></thead>
                            <tbody>{suppliers.map((s) => (
                                <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-2 text-white font-medium">{s.name}</td>
                                    <td className="py-3 px-2 text-white/50 text-xs">{s.contact_email ?? '—'}</td>
                                    <td className="py-3 px-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${s.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{s.status}</span>
                                    </td>
                                    <td className="py-3 px-2 text-white/50 text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
                                    <td className="py-3 px-2 text-right space-x-2">
                                        <button onClick={() => handleEdit(s)} className="text-xs text-brand-400 hover:text-brand-300">Editar</button>
                                        <button onClick={() => handleDelete(s.id)} className="text-xs text-red-400 hover:text-red-300">Excluir</button>
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
