'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface PO {
    id: string; status: string; currency: string; total_cost: string;
    created_at: string; sent_at: string | null;
    supplier: { name: string }; order: { external_order_number: string };
}

export default function PurchaseOrdersPage() {
    const [pos, setPOs] = useState<PO[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const pageSize = 20;

    useEffect(() => { load(); }, [page, status]);

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
            if (status) params.set('status', status);
            const data = await apiFetch<{ purchase_orders: PO[]; total: number }>(`/purchase-orders?${params}`);
            setPOs(data.purchase_orders); setTotal(data.total);
        } catch { } finally { setLoading(false); }
    };

    const stColor = (s: string) => {
        if (s === 'DISPATCHED') return 'bg-emerald-500/10 text-emerald-400';
        if (s === 'READY_TO_DISPATCH') return 'bg-blue-500/10 text-blue-400';
        if (s === 'CANCELLED') return 'bg-red-500/10 text-red-400';
        return 'bg-amber-500/10 text-amber-400';
    };
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Ordens de Compra</h1>
                <p className="text-white/40 mt-1">Ordens de compra do fornecedor geradas a partir de pedidos mapeados</p>
            </div>
            <div className="flex flex-wrap gap-3">
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input-field w-auto text-sm">
                    <option value="">Todos os Status</option>
                    <option value="CREATED">Criada</option>
                    <option value="READY_TO_DISPATCH">Pronta para Envio</option>
                    <option value="DISPATCHED">Enviada</option>
                    <option value="CANCELLED">Cancelada</option>
                </select>
                <span className="text-white/30 text-sm self-center">{total} OCs</span>
            </div>
            <div className="card">
                {loading ? <p className="text-white/30 text-sm">Carregando...</p> : pos.length === 0 ? <p className="text-white/30 text-sm">Nenhuma ordem de compra.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-white/10">
                                <th className="text-left py-3 px-2 text-white/40">ID OC</th>
                                <th className="text-left py-3 px-2 text-white/40">Pedido</th>
                                <th className="text-left py-3 px-2 text-white/40">Fornecedor</th>
                                <th className="text-left py-3 px-2 text-white/40">Status</th>
                                <th className="text-right py-3 px-2 text-white/40">Total</th>
                                <th className="text-left py-3 px-2 text-white/40">Criada</th>
                                <th className="text-left py-3 px-2 text-white/40">Enviada</th>
                                <th className="text-right py-3 px-2 text-white/40"></th>
                            </tr></thead>
                            <tbody>{pos.map((po) => (
                                <tr key={po.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-3 px-2 text-white font-mono text-xs">{po.id.slice(0, 8)}...</td>
                                    <td className="py-3 px-2 text-white/70 text-xs">#{po.order.external_order_number}</td>
                                    <td className="py-3 px-2 text-white/70 text-xs">{po.supplier.name}</td>
                                    <td className="py-3 px-2"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${stColor(po.status)}`}>{po.status}</span></td>
                                    <td className="py-3 px-2 text-right text-white font-mono text-xs">{po.currency} {Number(po.total_cost).toFixed(2)}</td>
                                    <td className="py-3 px-2 text-white/50 text-xs">{new Date(po.created_at).toLocaleDateString()}</td>
                                    <td className="py-3 px-2 text-white/50 text-xs">{po.sent_at ? new Date(po.sent_at).toLocaleDateString() : '—'}</td>
                                    <td className="py-3 px-2 text-right"><a href={`/dashboard/ops/purchase-orders/${po.id}`} className="text-xs text-brand-400 hover:text-brand-300">Ver</a></td>
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
