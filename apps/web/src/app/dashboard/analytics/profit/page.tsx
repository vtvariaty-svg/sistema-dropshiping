'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface ProfitRow {
    id: string; revenue: string; cogs: string; fees: string; shipping: string; ads_cost: string; net_profit: string; margin_percent: string; calculated_at: string;
    order: { external_order_number: string; channel: string; currency: string; total: string; created_at: string };
}

interface Summary { total_revenue: number; total_net_profit: number; avg_margin: number; order_count: number; }

export default function ProfitAnalyticsPage() {
    const [profits, setProfits] = useState<ProfitRow[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [channel, setChannel] = useState('');
    const pageSize = 20;

    useEffect(() => { load(); }, [page, channel]);

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
            if (channel) params.set('channel', channel);
            const data = await apiFetch<{ profits: ProfitRow[]; total: number; summary: Summary }>(`/analytics/profit?${params}`);
            setProfits(data.profits); setTotal(data.total); setSummary(data.summary);
        } catch { } finally { setLoading(false); }
    };

    const marginColor = (m: number) => m >= 20 ? 'text-emerald-400' : m >= 0 ? 'text-amber-400' : 'text-red-400';
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Profit Analytics</h1>
                <p className="text-white/40 mt-1">Order-level profitability breakdown</p>
            </div>

            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="card text-center"><p className="text-white/40 text-xs">Orders Calculated</p><p className="text-2xl font-bold text-white mt-1">{summary.order_count}</p></div>
                    <div className="card text-center"><p className="text-white/40 text-xs">Total Revenue</p><p className="text-2xl font-bold text-white mt-1">{summary.total_revenue.toFixed(2)}</p></div>
                    <div className="card text-center"><p className="text-white/40 text-xs">Total Net Profit</p><p className={`text-2xl font-bold mt-1 ${marginColor(summary.total_net_profit)}`}>{summary.total_net_profit.toFixed(2)}</p></div>
                    <div className="card text-center"><p className="text-white/40 text-xs">Avg Margin</p><p className={`text-2xl font-bold mt-1 ${marginColor(summary.avg_margin)}`}>{summary.avg_margin.toFixed(1)}%</p></div>
                </div>
            )}

            <div className="flex gap-3">
                <select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className="input-field w-auto text-sm">
                    <option value="">All Channels</option>
                    <option value="SHOPIFY">Shopify</option>
                </select>
            </div>

            <div className="card">
                {loading ? <p className="text-white/30 text-sm">Loading...</p> : profits.length === 0 ? <p className="text-white/30 text-sm">No profit data. Recalculate order profits first.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/10">
                                <th className="text-left py-3 px-2 text-white/40">Order</th>
                                <th className="text-left py-3 px-2 text-white/40">Channel</th>
                                <th className="text-right py-3 px-2 text-white/40">Revenue</th>
                                <th className="text-right py-3 px-2 text-white/40">COGS</th>
                                <th className="text-right py-3 px-2 text-white/40">Fees</th>
                                <th className="text-right py-3 px-2 text-white/40">Shipping</th>
                                <th className="text-right py-3 px-2 text-white/40">Net Profit</th>
                                <th className="text-right py-3 px-2 text-white/40">Margin</th>
                                <th className="text-left py-3 px-2 text-white/40">Calculated</th>
                            </tr></thead>
                            <tbody>{profits.map((p) => {
                                const margin = Number(p.margin_percent);
                                return (
                                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                        <td className="py-3 px-2 text-white text-xs">#{p.order.external_order_number}</td>
                                        <td className="py-3 px-2 text-white/50 text-xs">{p.order.channel}</td>
                                        <td className="py-3 px-2 text-right text-white font-mono text-xs">{Number(p.revenue).toFixed(2)}</td>
                                        <td className="py-3 px-2 text-right text-red-400/70 font-mono text-xs">-{Number(p.cogs).toFixed(2)}</td>
                                        <td className="py-3 px-2 text-right text-orange-400/70 font-mono text-xs">-{Number(p.fees).toFixed(2)}</td>
                                        <td className="py-3 px-2 text-right text-blue-400/70 font-mono text-xs">-{Number(p.shipping).toFixed(2)}</td>
                                        <td className={`py-3 px-2 text-right font-mono text-xs font-bold ${marginColor(Number(p.net_profit))}`}>{Number(p.net_profit).toFixed(2)}</td>
                                        <td className={`py-3 px-2 text-right font-mono text-xs font-bold ${marginColor(margin)}`}>{margin.toFixed(1)}%</td>
                                        <td className="py-3 px-2 text-white/30 text-xs">{new Date(p.calculated_at).toLocaleDateString()}</td>
                                    </tr>
                                );
                            })}</tbody>
                        </table>
                    </div>
                )}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-xs text-brand-400 disabled:opacity-30">← Previous</button>
                        <span className="text-xs text-white/30">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="text-xs text-brand-400 disabled:opacity-30">Next →</button>
                    </div>
                )}
            </div>
        </div>
    );
}
