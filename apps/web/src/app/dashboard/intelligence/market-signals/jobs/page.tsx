'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface Job {
    id: string; source: string; query: string; status: string; attempts: number;
    created_at: string; started_at: string | null; finished_at: string | null; error: string | null;
    cluster: { name_norm: string } | null;
}

export default function JobsPage() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ source: '', status: '' });
    const pageSize = 20;

    useEffect(() => { load(); }, [page, filter]);

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
            if (filter.source) params.set('source', filter.source);
            if (filter.status) params.set('status', filter.status);
            const data = await apiFetch<{ jobs: Job[]; total: number }>(`/market-signals/jobs?${params}`);
            setJobs(data.jobs); setTotal(data.total);
        } catch { } finally { setLoading(false); }
    };

    const statusColor = (s: string) => {
        if (s === 'SUCCESS') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (s === 'RUNNING') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (s === 'QUEUED') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        return 'bg-red-500/10 text-red-400 border-red-500/20';
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            <div>
                <a href="/dashboard/intelligence/market-signals" className="text-xs text-brand-400 hover:text-brand-300">← Voltar para Sinais de Mercado</a>
                <h1 className="text-2xl lg:text-3xl font-bold text-white mt-1">Trabalhos de Coleta</h1>
                <p className="text-white/40 mt-1">Histórico de todos os trabalhos de coleta de sinais de mercado</p>
            </div>

            <div className="flex gap-3">
                <select className="input-field w-auto" value={filter.source} onChange={(e) => { setFilter({ ...filter, source: e.target.value }); setPage(1); }}>
                    <option value="">Todas as Fontes</option>
                    <option value="SHOPEE">Shopee</option>
                    <option value="TIKTOK">TikTok</option>
                </select>
                <select className="input-field w-auto" value={filter.status} onChange={(e) => { setFilter({ ...filter, status: e.target.value }); setPage(1); }}>
                    <option value="">Todos os Status</option>
                    <option value="QUEUED">Na Fila</option>
                    <option value="RUNNING">Rodando</option>
                    <option value="SUCCESS">Sucesso</option>
                    <option value="FAILED">Falha</option>
                </select>
            </div>

            <div className="card">
                {loading ? <p className="text-white/30 text-sm">Carregando...</p> : jobs.length === 0 ? <p className="text-white/30 text-sm">Nenhum trabalho encontrado.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/10">
                                <th className="text-left py-3 px-2 text-white/40">Fonte</th>
                                <th className="text-left py-3 px-2 text-white/40">Cluster</th>
                                <th className="text-left py-3 px-2 text-white/40">Busca</th>
                                <th className="text-center py-3 px-2 text-white/40">Status</th>
                                <th className="text-right py-3 px-2 text-white/40">Tentativas</th>
                                <th className="text-left py-3 px-2 text-white/40">Criado Em</th>
                                <th className="text-left py-3 px-2 text-white/40">Finalizado Em</th>
                                <th className="text-left py-3 px-2 text-white/40">Erro</th>
                            </tr></thead>
                            <tbody>{jobs.map((j) => (
                                <tr key={j.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-2 text-white font-medium">{j.source}</td>
                                    <td className="py-3 px-2 text-white/50 text-xs">{j.cluster?.name_norm ?? '—'}</td>
                                    <td className="py-3 px-2 text-white/40 text-xs font-mono truncate max-w-[160px]">{j.query}</td>
                                    <td className="py-3 px-2 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(j.status)}`}>{j.status}</span></td>
                                    <td className="py-3 px-2 text-right text-white/30 font-mono text-xs">{j.attempts}</td>
                                    <td className="py-3 px-2 text-white/30 text-xs">{new Date(j.created_at).toLocaleString()}</td>
                                    <td className="py-3 px-2 text-white/30 text-xs">{j.finished_at ? new Date(j.finished_at).toLocaleString() : '—'}</td>
                                    <td className="py-3 px-2 text-red-400/60 text-xs truncate max-w-[150px]">{j.error ?? ''}</td>
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
