'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Cluster { id: string; name_norm: string }
interface Job {
    id: string; source: string; query: string; status: string; attempts: number;
    created_at: string; finished_at: string | null; error: string | null;
    cluster: { name_norm: string } | null;
}

export default function MarketSignalsPage() {
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [collecting, setCollecting] = useState(false);
    const [form, setForm] = useState({ cluster_id: '', source: 'SHOPEE', query: '' });
    const [message, setMessage] = useState('');

    useEffect(() => { load(); }, []);
    const load = async () => {
        try {
            const [c, j] = await Promise.all([
                apiFetch<Cluster[]>('/intelligence/clusters'),
                apiFetch<{ jobs: Job[] }>('/market-signals/jobs?page_size=10'),
            ]);
            setClusters(c); setJobs(j.jobs);
        } catch { } finally { setLoading(false); }
    };

    const collect = async () => {
        setCollecting(true); setMessage('');
        try {
            const body: Record<string, string> = { cluster_id: form.cluster_id, source: form.source };
            if (form.query) body.query = form.query;
            await apiFetch('/market-signals/collect', { method: 'POST', body: JSON.stringify(body) });
            setMessage('✅ Collection complete!'); load();
        } catch (e) { setMessage(`Failed: ${e}`); } finally { setCollecting(false); }
    };

    const statusColor = (s: string) => {
        if (s === 'SUCCESS') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (s === 'RUNNING') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (s === 'QUEUED') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        return 'bg-red-500/10 text-red-400 border-red-500/20';
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Market Signals</h1>
                <p className="text-white/40 mt-1">Collect external market data from Shopee and TikTok</p>
            </div>

            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Collect Signals</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select className="input-field" value={form.cluster_id} onChange={(e) => setForm({ ...form, cluster_id: e.target.value })}>
                        <option value="">Select Cluster</option>
                        {clusters.map((c) => <option key={c.id} value={c.id}>{c.name_norm}</option>)}
                    </select>
                    <select className="input-field" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                        <option value="SHOPEE">Shopee</option>
                        <option value="TIKTOK">TikTok</option>
                    </select>
                    <input className="input-field" placeholder="Custom query (optional)" value={form.query} onChange={(e) => setForm({ ...form, query: e.target.value })} />
                    <button onClick={collect} disabled={collecting || !form.cluster_id} className="btn-primary text-sm">{collecting ? 'Collecting...' : '📡 Collect'}</button>
                </div>
                {message && <p className={`text-sm mt-2 ${message.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>{message}</p>}
            </div>

            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Recent Jobs</h2>
                {loading ? <p className="text-white/30 text-sm">Loading...</p> : jobs.length === 0 ? <p className="text-white/30 text-sm">No collection jobs yet.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/10">
                                <th className="text-left py-3 px-2 text-white/40">Source</th>
                                <th className="text-left py-3 px-2 text-white/40">Cluster</th>
                                <th className="text-left py-3 px-2 text-white/40">Query</th>
                                <th className="text-center py-3 px-2 text-white/40">Status</th>
                                <th className="text-left py-3 px-2 text-white/40">Created</th>
                            </tr></thead>
                            <tbody>{jobs.map((j) => (
                                <tr key={j.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-2 text-white font-medium">{j.source}</td>
                                    <td className="py-3 px-2 text-white/50 text-xs">{j.cluster?.name_norm ?? '—'}</td>
                                    <td className="py-3 px-2 text-white/40 text-xs font-mono truncate max-w-[200px]">{j.query}</td>
                                    <td className="py-3 px-2 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(j.status)}`}>{j.status}</span></td>
                                    <td className="py-3 px-2 text-white/30 text-xs">{new Date(j.created_at).toLocaleString()}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}
                <div className="mt-3 text-right"><a href="/dashboard/intelligence/market-signals/jobs" className="text-xs text-brand-400 hover:text-brand-300">View All Jobs →</a></div>
            </div>
        </div>
    );
}
