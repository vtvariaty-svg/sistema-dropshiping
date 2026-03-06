'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface FeeProfile {
    id: string; channel: string; fee_percent: string; payment_fee_percent: string; fixed_fee: string; active: boolean; created_at: string;
}

export default function FeesPage() {
    const [profiles, setProfiles] = useState<FeeProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ channel: 'SHOPIFY', fee_percent: '', payment_fee_percent: '', fixed_fee: '', active: true });
    const [editId, setEditId] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    useEffect(() => { load(); }, []);
    const load = async () => { try { setProfiles(await apiFetch('/fee-profiles')); } catch { } finally { setLoading(false); } };

    const handleSubmit = async () => {
        setMessage('');
        try {
            const body = { channel: form.channel, fee_percent: Number(form.fee_percent), payment_fee_percent: Number(form.payment_fee_percent), fixed_fee: Number(form.fixed_fee), active: form.active };
            if (editId) { await apiFetch(`/fee-profiles/${editId}`, { method: 'PUT', body: JSON.stringify(body) }); }
            else { await apiFetch('/fee-profiles', { method: 'POST', body: JSON.stringify(body) }); }
            setForm({ channel: 'SHOPIFY', fee_percent: '', payment_fee_percent: '', fixed_fee: '', active: true }); setEditId(null); load();
        } catch (e) { setMessage(`Failed: ${e}`); }
    };

    const startEdit = (p: FeeProfile) => {
        setEditId(p.id); setForm({ channel: p.channel, fee_percent: String(p.fee_percent), payment_fee_percent: String(p.payment_fee_percent), fixed_fee: String(p.fixed_fee), active: p.active });
    };

    const handleDelete = async (id: string) => {
        try { await apiFetch(`/fee-profiles/${id}`, { method: 'DELETE' }); load(); } catch { }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Perfis de Taxas</h1>
                <p className="text-white/40 mt-1">Configure taxas de canal e pagamento para cálculo de lucro</p>
            </div>

            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">{editId ? 'Editar Perfil' : 'Novo Perfil'}</h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <select className="input-field" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                        <option value="SHOPIFY">Shopify</option>
                        <option value="MANUAL">Manual</option>
                    </select>
                    <input className="input-field" placeholder="Taxa do Canal %" type="number" step="0.01" value={form.fee_percent} onChange={(e) => setForm({ ...form, fee_percent: e.target.value })} />
                    <input className="input-field" placeholder="Taxa de Pagamento %" type="number" step="0.01" value={form.payment_fee_percent} onChange={(e) => setForm({ ...form, payment_fee_percent: e.target.value })} />
                    <input className="input-field" placeholder="Taxa Fixa" type="number" step="0.01" value={form.fixed_fee} onChange={(e) => setForm({ ...form, fixed_fee: e.target.value })} />
                    <button onClick={handleSubmit} className="btn-primary text-sm">{editId ? 'Atualizar' : 'Criar'}</button>
                </div>
                {message && <p className="text-red-400 text-sm mt-2">{message}</p>}
            </div>

            <div className="card">
                {loading ? <p className="text-white/30 text-sm">Carregando...</p> : profiles.length === 0 ? <p className="text-white/30 text-sm">Sem perfis de taxas.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/10">
                                <th className="text-left py-3 px-2 text-white/40">Canal</th>
                                <th className="text-right py-3 px-2 text-white/40">Taxa do Canal %</th>
                                <th className="text-right py-3 px-2 text-white/40">Taxa de Pagamento %</th>
                                <th className="text-right py-3 px-2 text-white/40">Taxa Fixa</th>
                                <th className="text-center py-3 px-2 text-white/40">Ativo</th>
                                <th className="text-right py-3 px-2 text-white/40"></th>
                            </tr></thead>
                            <tbody>{profiles.map((p) => (
                                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-2 text-white">{p.channel}</td>
                                    <td className="py-3 px-2 text-right text-white font-mono">{Number(p.fee_percent).toFixed(2)}%</td>
                                    <td className="py-3 px-2 text-right text-white font-mono">{Number(p.payment_fee_percent).toFixed(2)}%</td>
                                    <td className="py-3 px-2 text-right text-white font-mono">{Number(p.fixed_fee).toFixed(2)}</td>
                                    <td className="py-3 px-2 text-center">{p.active ? <span className="text-emerald-400">●</span> : <span className="text-white/20">○</span>}</td>
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
