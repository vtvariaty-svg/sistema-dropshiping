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

interface MarketSummary {
    summary: { external_demand_score: string | null; external_competition_score: string | null; external_viral_score: string | null; summary_version: string; calculated_at: string } | null;
    latestShopee: { price_avg: string | null; sales_est: string | null; sellers_count: number | null; rating_avg: string | null; reviews_count: number | null; snapshot_at: string } | null;
    latestTiktok: { videos_count: number | null; views_total: string | null; likes_avg: string | null; growth_rate: string | null; snapshot_at: string } | null;
}

export default function ClusterDetailPage() {
    const params = useParams();
    const clusterId = params.id as string;
    const [cluster, setCluster] = useState<ClusterDetail | null>(null);
    const [market, setMarket] = useState<MarketSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [recomputing, setRecomputing] = useState(false);
    const [collecting, setCollecting] = useState('');

    useEffect(() => { load(); }, [clusterId]);
    const load = async () => {
        try {
            const [c, m] = await Promise.all([
                apiFetch<ClusterDetail>(`/intelligence/clusters/${clusterId}`),
                apiFetch<MarketSummary>(`/market-signals/clusters/${clusterId}/summary`),
            ]);
            setCluster(c); setMarket(m);
        } catch { } finally { setLoading(false); }
    };

    const recompute = async () => { setRecomputing(true); try { await apiFetch(`/intelligence/clusters/${clusterId}/recompute`, { method: 'POST' }); load(); } catch { } finally { setRecomputing(false); } };

    const collectSignals = async (source: string) => {
        setCollecting(source);
        try { await apiFetch('/market-signals/collect', { method: 'POST', body: JSON.stringify({ cluster_id: clusterId, source }) }); load(); } catch { } finally { setCollecting(''); }
    };

    const recomputeSummary = async () => { try { await apiFetch(`/market-signals/clusters/${clusterId}/recompute-summary`, { method: 'POST' }); load(); } catch { } };
    const recomputeScore = async () => { try { await apiFetch(`/market-signals/clusters/${clusterId}/recompute-score`, { method: 'POST' }); load(); } catch { } };

    const recColor = (r: string) => {
        if (r === 'SCALE') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (r === 'TEST') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (r === 'MONITOR') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        return 'bg-red-500/10 text-red-400 border-red-500/20';
    };

    if (loading) return <div className="text-white/30">Carregando...</div>;
    if (!cluster) return <div className="text-red-400">Cluster não encontrado</div>;

    const s = market?.summary;
    const sh = market?.latestShopee;
    const tk = market?.latestTiktok;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <a href="/dashboard/intelligence/clusters" className="text-xs text-brand-400 hover:text-brand-300">← Voltar para Clusters</a>
                    <h1 className="text-2xl lg:text-3xl font-bold text-white mt-1">{cluster.name_norm}</h1>
                    <p className="text-white/30 text-xs font-mono mt-1">#{cluster.fingerprint}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => collectSignals('SHOPEE')} disabled={!!collecting} className="btn-primary text-xs">{collecting === 'SHOPEE' ? '...' : '📡 Shopee'}</button>
                    <button onClick={() => collectSignals('TIKTOK')} disabled={!!collecting} className="btn-primary text-xs">{collecting === 'TIKTOK' ? '...' : '🎵 TikTok'}</button>
                    <button onClick={recompute} disabled={recomputing} className="btn-primary text-xs">{recomputing ? '...' : '🔄 Pontuação'}</button>
                </div>
            </div>

            {/* Internal Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card text-center"><p className="text-white/40 text-xs">Pedidos</p><p className="text-2xl font-bold text-white mt-1">{cluster.metrics.orderCount}</p></div>
                <div className="card text-center"><p className="text-white/40 text-xs">Qtd Total</p><p className="text-2xl font-bold text-white mt-1">{cluster.metrics.totalQty}</p></div>
                <div className="card text-center"><p className="text-white/40 text-xs">Receita</p><p className="text-2xl font-bold text-white mt-1">{cluster.metrics.revenue.toFixed(2)}</p></div>
                <div className="card text-center"><p className="text-white/40 text-xs">Margem Média</p><p className={`text-2xl font-bold mt-1 ${cluster.metrics.avgMargin >= 20 ? 'text-emerald-400' : cluster.metrics.avgMargin >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{cluster.metrics.avgMargin.toFixed(1)}%</p></div>
            </div>

            {/* Score Breakdown */}
            {cluster.score ? (
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">Detalhamento da Pontuação</h2>
                        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-bold border ${recColor(cluster.score.recommendation)}`}>{cluster.score.recommendation}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div><span className="text-white/40 block">Margem</span><span className="text-white font-mono font-bold">{Number(cluster.score.margin_score).toFixed(1)}</span></div>
                        <div><span className="text-white/40 block">Demanda</span><span className="text-white font-mono font-bold">{Number(cluster.score.demand_score).toFixed(1)}</span></div>
                        <div><span className="text-white/40 block">Concorrência</span><span className="text-white font-mono font-bold">{Number(cluster.score.competition_score).toFixed(1)}</span></div>
                        <div><span className="text-white/40 block">Viral</span><span className="text-white font-mono font-bold">{Number(cluster.score.viral_score).toFixed(1)}</span></div>
                        <div><span className="text-white/40 block">Final</span><span className="text-white font-mono text-xl font-bold">{Number(cluster.score.final_score).toFixed(1)}</span></div>
                    </div>
                    <p className="text-white/20 text-xs mt-4">v{cluster.score.score_version} · Calculado em {new Date(cluster.score.calculated_at).toLocaleString()}</p>
                </div>
            ) : (
                <div className="card"><p className="text-white/30 text-sm">Sem pontuação ainda. Clique em Recomputar.</p></div>
            )}

            {/* External Market Summary */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">📊 Resumo do Mercado Externo</h2>
                    <div className="flex gap-2">
                        <button onClick={recomputeSummary} className="text-xs text-brand-400 hover:text-brand-300">Recomputar Resumo</button>
                        <button onClick={recomputeScore} className="text-xs text-purple-400 hover:text-purple-300">Recomputar Pontuação Completa</button>
                    </div>
                </div>
                {s ? (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div><span className="text-white/40 block">Demanda Ext.</span><span className="text-white font-mono font-bold">{s.external_demand_score != null ? Number(s.external_demand_score).toFixed(1) : '—'}</span></div>
                        <div><span className="text-white/40 block">Concorrência Ext.</span><span className="text-white font-mono font-bold">{s.external_competition_score != null ? Number(s.external_competition_score).toFixed(1) : '—'}</span></div>
                        <div><span className="text-white/40 block">Viral Ext.</span><span className="text-white font-mono font-bold">{s.external_viral_score != null ? Number(s.external_viral_score).toFixed(1) : '—'}</span></div>
                    </div>
                ) : <p className="text-white/30 text-sm">Sem resumo externo. Colete sinais primeiro.</p>}
            </div>

            {/* Latest Shopee */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card">
                    <h2 className="text-base font-semibold text-white mb-3">🛒 Shopee (Últimos Dados)</h2>
                    {sh ? (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-white/40 block text-xs">Preço Médio</span><span className="text-white font-mono">{sh.price_avg ? Number(sh.price_avg).toFixed(2) : '—'}</span></div>
                            <div><span className="text-white/40 block text-xs">Vendas Est.</span><span className="text-white font-mono">{sh.sales_est ? Number(sh.sales_est).toFixed(0) : '—'}</span></div>
                            <div><span className="text-white/40 block text-xs">Vendedores</span><span className="text-white font-mono">{sh.sellers_count ?? '—'}</span></div>
                            <div><span className="text-white/40 block text-xs">Avaliação</span><span className="text-white font-mono">{sh.rating_avg ? `⭐ ${Number(sh.rating_avg).toFixed(1)}` : '—'}</span></div>
                            <div><span className="text-white/40 block text-xs">Comentários</span><span className="text-white font-mono">{sh.reviews_count ?? '—'}</span></div>
                            <div><span className="text-white/40 block text-xs">Coletado</span><span className="text-white/30 text-xs">{new Date(sh.snapshot_at).toLocaleString()}</span></div>
                        </div>
                    ) : <p className="text-white/30 text-sm">Nenhum dado da Shopee coletado.</p>}
                </div>

                <div className="card">
                    <h2 className="text-base font-semibold text-white mb-3">🎵 TikTok (Últimos Dados)</h2>
                    {tk ? (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-white/40 block text-xs">Vídeos</span><span className="text-white font-mono">{tk.videos_count ?? '—'}</span></div>
                            <div><span className="text-white/40 block text-xs">Total de Visualizações</span><span className="text-white font-mono">{tk.views_total ? Number(tk.views_total).toLocaleString() : '—'}</span></div>
                            <div><span className="text-white/40 block text-xs">Curtidas Média</span><span className="text-white font-mono">{tk.likes_avg ? Number(tk.likes_avg).toLocaleString() : '—'}</span></div>
                            <div><span className="text-white/40 block text-xs">Taxa de Cresc.</span><span className={`font-mono ${Number(tk.growth_rate ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{tk.growth_rate ? `${Number(tk.growth_rate).toFixed(1)}%` : '—'}</span></div>
                            <div className="col-span-2"><span className="text-white/40 block text-xs">Coletado</span><span className="text-white/30 text-xs">{new Date(tk.snapshot_at).toLocaleString()}</span></div>
                        </div>
                    ) : <p className="text-white/30 text-sm">Nenhum dado do TikTok coletado.</p>}
                </div>
            </div>

            {/* Linked Products */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Produtos Vinculados ({cluster.cluster_links.length})</h2>
                {cluster.cluster_links.length === 0 ? <p className="text-white/30 text-sm">Nenhum produto vinculado.</p> : (
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
