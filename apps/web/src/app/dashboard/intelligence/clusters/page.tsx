'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Cluster {
    id: string; name_norm: string; fingerprint: string; created_at: string;
    score: { final_score: string; recommendation: string; calculated_at: string } | null;
    cluster_links: Array<{ product: { name_raw: string } }>;
}

export default function ClustersPage() {
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [loading, setLoading] = useState(true);
    const [recomputing, setRecomputing] = useState(false);
    const [filter, setFilter] = useState('');

    useEffect(() => { load(); }, []);
    const load = async () => { try { setClusters(await apiFetch('/intelligence/clusters')); } catch { } finally { setLoading(false); } };

    const recomputeAll = async () => {
        setRecomputing(true);
        try { await apiFetch('/intelligence/clusters/recompute', { method: 'POST' }); load(); } catch { } finally { setRecomputing(false); }
    };

    const recColor = (r: string) => {
        if (r === 'SCALE') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (r === 'TEST') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (r === 'MONITOR') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        return 'bg-red-500/10 text-red-400 border-red-500/20';
    };

    const filtered = clusters.filter((c) => !filter || c.score?.recommendation === filter);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-white">Product Clusters</h1>
                    <p className="text-white/40 mt-1">Normalized product groupings with intelligence scores</p>
                </div>
                <button onClick={recomputeAll} disabled={recomputing} className="btn-primary text-sm">{recomputing ? 'Computing...' : '🔄 Recompute All'}</button>
            </div>

            <div className="flex gap-2">
                {['', 'SCALE', 'TEST', 'MONITOR', 'AVOID'].map((f) => (
                    <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${filter === f ? 'border-brand-400 text-brand-400 bg-brand-400/10' : 'border-white/10 text-white/40 hover:border-white/20'}`}>
                        {f || 'All'}
                    </button>
                ))}
            </div>

            <div className="card">
                {loading ? <p className="text-white/30 text-sm">Loading...</p> : filtered.length === 0 ? <p className="text-white/30 text-sm">No clusters found.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/10">
                                <th className="text-left py-3 px-2 text-white/40">Cluster Name</th>
                                <th className="text-right py-3 px-2 text-white/40">Score</th>
                                <th className="text-center py-3 px-2 text-white/40">Recommendation</th>
                                <th className="text-left py-3 px-2 text-white/40">Products</th>
                                <th className="text-left py-3 px-2 text-white/40">Calculated</th>
                                <th className="text-right py-3 px-2 text-white/40"></th>
                            </tr></thead>
                            <tbody>{filtered.map((c) => (
                                <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-2 text-white font-medium">{c.name_norm}</td>
                                    <td className="py-3 px-2 text-right text-white font-mono font-bold">{c.score ? Number(c.score.final_score).toFixed(1) : '—'}</td>
                                    <td className="py-3 px-2 text-center">{c.score ? <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${recColor(c.score.recommendation)}`}>{c.score.recommendation}</span> : <span className="text-white/20">—</span>}</td>
                                    <td className="py-3 px-2 text-white/50 text-xs">{c.cluster_links.length}</td>
                                    <td className="py-3 px-2 text-white/30 text-xs">{c.score ? new Date(c.score.calculated_at).toLocaleDateString() : '—'}</td>
                                    <td className="py-3 px-2 text-right"><a href={`/dashboard/intelligence/clusters/${c.id}`} className="text-xs text-brand-400 hover:text-brand-300">View →</a></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
