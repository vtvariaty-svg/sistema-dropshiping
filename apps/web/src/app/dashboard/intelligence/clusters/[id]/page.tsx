'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface ClusterDetail {
    id: string; name_norm: string; fingerprint: string;
    score: { margin_score: string; demand_score: string; competition_score: string; viral_score: string; final_score: string; recommendation: string; score_version: string; calculated_at: string } | null;
    cluster_links: Array<{ product: { id: string; name_raw: string; category: string | null } }>;
    metrics: { orderCount: number; totalQty: number; revenue: number; avgMargin: number };
}

export default function ClusterDetailPage() {
    const params = useParams();
    const clusterId = params.id as string;
    const [cluster, setCluster] = useState<ClusterDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [recomputing, setRecomputing] = useState(false);

    useEffect(() => { load(); }, [clusterId]);
    const load = async () => { try { setCluster(await apiFetch(`/intelligence/clusters/${clusterId}`)); } catch { } finally { setLoading(false); } };

    const recompute = async () => {
        setRecomputing(true);
        try { await apiFetch(`/intelligence/clusters/${clusterId}/recompute`, { method: 'POST' }); load(); } catch { } finally { setRecomputing(false); }
    };

    const recColor = (r: string) => {
        if (r === 'SCALE') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (r === 'TEST') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (r === 'MONITOR') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        return 'bg-red-500/10 text-red-400 border-red-500/20';
    };

    if (loading) return <div className="text-white/30">Loading...</div>;
    if (!cluster) return <div className="text-red-400">Cluster not found</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <a href="/dashboard/intelligence/clusters" className="text-xs text-brand-400 hover:text-brand-300">← Back to Clusters</a>
                    <h1 className="text-2xl lg:text-3xl font-bold text-white mt-1">{cluster.name_norm}</h1>
                    <p className="text-white/30 text-xs font-mono mt-1">#{cluster.fingerprint}</p>
                </div>
                <button onClick={recompute} disabled={recomputing} className="btn-primary text-sm">{recomputing ? 'Computing...' : '🔄 Recompute'}</button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card text-center"><p className="text-white/40 text-xs">Orders</p><p className="text-2xl font-bold text-white mt-1">{cluster.metrics.orderCount}</p></div>
                <div className="card text-center"><p className="text-white/40 text-xs">Total Qty</p><p className="text-2xl font-bold text-white mt-1">{cluster.metrics.totalQty}</p></div>
                <div className="card text-center"><p className="text-white/40 text-xs">Revenue</p><p className="text-2xl font-bold text-white mt-1">{cluster.metrics.revenue.toFixed(2)}</p></div>
                <div className="card text-center"><p className="text-white/40 text-xs">Avg Margin</p><p className={`text-2xl font-bold mt-1 ${cluster.metrics.avgMargin >= 20 ? 'text-emerald-400' : cluster.metrics.avgMargin >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{cluster.metrics.avgMargin.toFixed(1)}%</p></div>
            </div>

            {/* Score Breakdown */}
            {cluster.score ? (
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">Score Breakdown</h2>
                        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-bold border ${recColor(cluster.score.recommendation)}`}>{cluster.score.recommendation}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div><span className="text-white/40 block">Margin</span><span className="text-white font-mono font-bold">{Number(cluster.score.margin_score).toFixed(1)}</span></div>
                        <div><span className="text-white/40 block">Demand</span><span className="text-white font-mono font-bold">{Number(cluster.score.demand_score).toFixed(1)}</span></div>
                        <div><span className="text-white/40 block">Competition</span><span className="text-white font-mono font-bold">{Number(cluster.score.competition_score).toFixed(1)}</span></div>
                        <div><span className="text-white/40 block">Viral</span><span className="text-white font-mono font-bold">{Number(cluster.score.viral_score).toFixed(1)}</span></div>
                        <div><span className="text-white/40 block">Final</span><span className="text-white font-mono text-xl font-bold">{Number(cluster.score.final_score).toFixed(1)}</span></div>
                    </div>
                    <p className="text-white/20 text-xs mt-4">v{cluster.score.score_version} · Calculated {new Date(cluster.score.calculated_at).toLocaleString()}</p>
                </div>
            ) : (
                <div className="card"><p className="text-white/30 text-sm">No score yet. Click Recompute.</p></div>
            )}

            {/* Linked Products */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Linked Products ({cluster.cluster_links.length})</h2>
                {cluster.cluster_links.length === 0 ? <p className="text-white/30 text-sm">No products linked.</p> : (
                    <div className="space-y-2">
                        {cluster.cluster_links.map((link, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                <span className="text-white text-sm font-medium">{link.product.name_raw}</span>
                                {link.product.category && <span className="text-white/30 text-xs ml-auto">{link.product.category}</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
