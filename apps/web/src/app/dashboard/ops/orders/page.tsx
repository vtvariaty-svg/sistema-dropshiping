'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface OrderRow {
    id: string; external_order_number: string; channel: string; store_id: string | null;
    financial_status: string; fulfillment_status: string | null; operational_status: string | null;
    total: string; currency: string; created_at: string;
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [opStatus, setOpStatus] = useState('');
    const [channel, setChannel] = useState('');
    const pageSize = 20;

    useEffect(() => { loadOrders(); }, [page, status, opStatus, channel]);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
            if (status) params.set('status', status);
            if (opStatus) params.set('operational_status', opStatus);
            if (channel) params.set('channel', channel);
            const data = await apiFetch<{ orders: OrderRow[]; total: number }>(`/orders?${params}`);
            setOrders(data.orders); setTotal(data.total);
        } catch { } finally { setLoading(false); }
    };

    const statusColor = (s: string) => {
        if (s === 'paid') return 'bg-emerald-500/10 text-emerald-400';
        if (s === 'refunded' || s === 'voided') return 'bg-red-500/10 text-red-400';
        return 'bg-amber-500/10 text-amber-400';
    };
    const opColor = (s: string | null) => {
        if (s === 'READY_FOR_PO') return 'bg-emerald-500/10 text-emerald-400';
        if (s === 'NEEDS_MAPPING') return 'bg-orange-500/10 text-orange-400';
        if (s === 'PO_CREATED' || s === 'FULFILLED') return 'bg-blue-500/10 text-blue-400';
        return 'bg-white/5 text-white/40';
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Pedidos</h1>
                <p className="text-white/40 mt-1">Pipeline de pedidos internos — importados das lojas conectadas</p>
            </div>
            <div className="flex flex-wrap gap-3">
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field w-auto text-sm">
                    <option value="">Todos (Pagamento)</option>
                    <option value="paid">Pago</option><option value="pending">Pendente</option>
                    <option value="refunded">Reembolsado</option>
                </select>
                <select value={opStatus} onChange={(e) => { setOpStatus(e.target.value); setPage(1); }} className="input-field w-auto text-sm">
                    <option value="">Todos (Pipeline)</option>
                    <option value="NEW">Novo</option><option value="NEEDS_MAPPING">Precisa de Mapeamento</option>
                    <option value="READY_FOR_PO">Pronto pra OC</option>
                </select>
                <select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className="input-field w-auto text-sm">
                    <option value="">Todos (Canal)</option>
                    <option value="SHOPIFY">🛍️ Shopify</option>
                    <option value="TIKTOK_SHOP">🎵 TikTok Shop</option>
                </select>
                <span className="text-white/30 text-sm self-center">{total} pedidos</span>
            </div>
            <div className="card">
                {loading ? <p className="text-white/30 text-sm">Carregando...</p> : orders.length === 0 ? <p className="text-white/30 text-sm">Nenhum pedido encontrado.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/10">
                                <th className="text-left py-3 px-2 text-white/40 font-medium">Pedido #</th>
                                <th className="text-left py-3 px-2 text-white/40 font-medium">Canal</th>
                                <th className="text-left py-3 px-2 text-white/40 font-medium">Pagamento</th>
                                <th className="text-left py-3 px-2 text-white/40 font-medium">Pipeline</th>
                                <th className="text-left py-3 px-2 text-white/40 font-medium">Atendimento</th>
                                <th className="text-right py-3 px-2 text-white/40 font-medium">Total</th>
                                <th className="text-left py-3 px-2 text-white/40 font-medium">Data</th>
                                <th className="text-right py-3 px-2 text-white/40 font-medium"></th>
                            </tr></thead>
                            <tbody>{orders.map((o) => (
                                <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-2 text-white font-mono text-xs">#{o.external_order_number}</td>
                                    <td className="py-3 px-2 text-xs">{o.channel === 'TIKTOK_SHOP' ? '🎵' : '🛍️'}</td>
                                    <td className="py-3 px-2"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(o.financial_status)}`}>{o.financial_status}</span></td>
                                    <td className="py-3 px-2"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${opColor(o.operational_status)}`}>{o.operational_status ?? 'NEW'}</span></td>
                                    <td className="py-3 px-2 text-white/50 text-xs">{o.fulfillment_status ?? 'unfulfilled'}</td>
                                    <td className="py-3 px-2 text-right text-white font-mono text-xs">{o.currency} {Number(o.total).toFixed(2)}</td>
                                    <td className="py-3 px-2 text-white/50 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                                    <td className="py-3 px-2 text-right"><a href={`/dashboard/ops/orders/${o.id}`} className="text-xs text-brand-400 hover:text-brand-300">Ver</a></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-xs text-brand-400 disabled:opacity-30">← Anterior</button>
                        <span className="text-xs text-white/30">Página {page} de {totalPages}</span>
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="text-xs text-brand-400 disabled:opacity-30">Próximo →</button>
                    </div>
                )}
            </div>
        </div>
    );
}
