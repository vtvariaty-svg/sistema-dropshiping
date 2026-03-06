'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface ShippingProfile {
    id: string; name: string; rule_type: string; avg_shipping_cost: string; active: boolean; created_at: string;
}

export default function ShippingPage() {
    const [profiles, setProfiles] = useState<ShippingProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', rule_type: 'flat', avg_shipping_cost: '', active: true });
    const [editId, setEditId] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    useEffect(() => { load(); }, []);
    const load = async () => { try { setProfiles(await apiFetch('/shipping-profiles')); } catch { } finally { setLoading(false); } };

    const handleSubmit = async () => {
        setMessage('');
        try {
            const body = { name: form.name, rule_type: form.rule_type, avg_shipping_cost: Number(form.avg_shipping_cost), active: form.active };
            if (editId) { await apiFetch(`/shipping-profiles/${editId}`, { method: 'PUT', body: JSON.stringify(body) }); }
            else { await apiFetch('/shipping-profiles', { method: 'POST', body: JSON.stringify(body) }); }
            setForm({ name: '', rule_type: 'flat', avg_shipping_cost: '', active: true }); setEditId(null); load();
        } catch (e) { setMessage(`Failed: ${e}`); }
    };

    const startEdit = (p: ShippingProfile) => {
        setEditId(p.id); setForm({ name: p.name, rule_type: p.rule_type, avg_shipping_cost: String(p.avg_shipping_cost), active: p.active });
    };

    const handleDelete = async (id: string) => {
        try { await apiFetch(`/shipping-profiles/${id}`, { method: 'DELETE' }); load(); } catch { }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Shipping Profiles</h1>
                <p className="text-white/40 mt-1">Configure shipping cost rules for profit calculation</p>
            </div>

            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">{editId ? 'Edit Profile' : 'New Profile'}</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input className="input-field" placeholder="Profile Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <select className="input-field" value={form.rule_type} onChange={(e) => setForm({ ...form, rule_type: e.target.value })}>
                        <option value="flat">Flat</option>
                        <option value="fallback_default">Fallback Default</option>
                    </select>
                    <input className="input-field" placeholder="Avg Shipping Cost" type="number" step="0.01" value={form.avg_shipping_cost} onChange={(e) => setForm({ ...form, avg_shipping_cost: e.target.value })} />
                    <button onClick={handleSubmit} className="btn-primary text-sm">{editId ? 'Update' : 'Create'}</button>
                </div>
                {message && <p className="text-red-400 text-sm mt-2">{message}</p>}
            </div>

            <div className="card">
                {loading ? <p className="text-white/30 text-sm">Loading...</p> : profiles.length === 0 ? <p className="text-white/30 text-sm">No shipping profiles.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/10">
                                <th className="text-left py-3 px-2 text-white/40">Name</th>
                                <th className="text-left py-3 px-2 text-white/40">Rule</th>
                                <th className="text-right py-3 px-2 text-white/40">Avg Cost</th>
                                <th className="text-center py-3 px-2 text-white/40">Active</th>
                                <th className="text-right py-3 px-2 text-white/40"></th>
                            </tr></thead>
                            <tbody>{profiles.map((p) => (
                                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-2 text-white font-medium">{p.name}</td>
                                    <td className="py-3 px-2 text-white/50">{p.rule_type}</td>
                                    <td className="py-3 px-2 text-right text-white font-mono">{Number(p.avg_shipping_cost).toFixed(2)}</td>
                                    <td className="py-3 px-2 text-center">{p.active ? <span className="text-emerald-400">●</span> : <span className="text-white/20">○</span>}</td>
                                    <td className="py-3 px-2 text-right space-x-2">
                                        <button onClick={() => startEdit(p)} className="text-xs text-brand-400 hover:text-brand-300">Edit</button>
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
