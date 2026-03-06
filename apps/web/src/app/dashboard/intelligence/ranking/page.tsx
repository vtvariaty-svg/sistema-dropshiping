'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface ScoreRow {
    id: string; final_score: string; recommendation: string; margin_score: string; demand_score: string; calculated_at: string;
    cluster: { id: string; name_norm: string };
}

export default function RankingPage() {
    const [scores, setScores] = useState<ScoreRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const pageSize = 20;

    useEffect(() => { load(); }, [page, filter]);

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
            if (filter) params.set('recommendation', filter);
            const data = await apiFetch<{ scores: ScoreRow[]; total: number }>(`/intelligence/ranking?${params}`);
            setScores(data.scores); setTotal(data.total);
        } catch { } finally { setLoading(false); }
    };

    const recColor = (r: string) => {
        if (r === 'SCALE') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (r === 'TEST') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (r === 'MONITOR') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        return 'bg-red-500/10 text-red-400 border-red-500/20';
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Ranking de Produtos</h1>
                <p className="text-white/40 mt-1">Produtos classificados por pontuação de inteligência</p>
            </div>

            <div className="flex gap-2">
                {['', 'SCALE', 'TEST', 'MONITOR', 'AVOID'].map((f) => (
                    <button key={f} onClick={() => { setFilter(f); setPage(1); }} className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${filter === f ? 'border-brand-400 text-brand-400 bg-brand-400/10' : 'border-white/10 text-white/40 hover:border-white/20'}`}>
                        {f || 'Todos'}
                    </button>
                ))}
            </div>

            <div className="card">
                {loading ? <p className="text-white/30 text-sm">Carregando...</p> : scores.length === 0 ? <p className="text-white/30 text-sm">Sem pontuações. Recompute as pontuações dos clusters primeiro.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/10">
                                <th className="text-left py-3 px-2 text-white/40">#</th>
                                <th className="text-left py-3 px-2 text-white/40">Cluster</th>
                                <th className="text-right py-3 px-2 text-white/40">Pontuação</th>
                                <th className="text-center py-3 px-2 text-white/40">Recomendação</th>
                                <th className="text-right py-3 px-2 text-white/40">Pont. Margem</th>
                                <th className="text-right py-3 px-2 text-white/40">Pont. Demanda</th>
                                <th className="text-left py-3 px-2 text-white/40">Calculado Em</th>
                            </tr></thead>
                            <tbody>{scores.map((s, i) => (
                                <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-2 text-white/30 font-mono text-xs">{(page - 1) * pageSize + i + 1}</td>
                                    <td className="py-3 px-2"><a href={`/dashboard/intelligence/clusters/${s.cluster.id}`} className="text-white font-medium hover:text-brand-400 transition-colors">{s.cluster.name_norm}</a></td>
                                    <td className="py-3 px-2 text-right text-white font-mono text-lg font-bold">{Number(s.final_score).toFixed(1)}</td>
                                    <td className="py-3 px-2 text-center"><span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${recColor(s.recommendation)}`}>{s.recommendation}</span></td>
                                    <td className="py-3 px-2 text-right text-white/50 font-mono text-xs">{Number(s.margin_score).toFixed(0)}</td>
                                    <td className="py-3 px-2 text-right text-white/50 font-mono text-xs">{Number(s.demand_score).toFixed(0)}</td>
                                    <td className="py-3 px-2 text-white/30 text-xs">{new Date(s.calculated_at).toLocaleDateString()}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-xs text-brand-400 disabled:opacity-30">← Anterior</button>
                        <span className="text-xs text-white/30">Página {page} de {totalPages}</span>
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="text-xs text-brand-400 disabled:opacity-30">Próxima →</button>
                    </div>
                )}
            </div>
        </div>
    );
}
