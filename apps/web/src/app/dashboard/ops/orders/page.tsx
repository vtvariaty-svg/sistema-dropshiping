'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface OrderRow {
    id: string; external_order_number: string; channel: string; store_id: string | null;
    financial_status: string; fulfillment_status: string | null;
    total: string; currency: string; created_at: string;
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const pageSize = 20;

    useEffect(() => { loadOrders(); }, [page, status]);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
            if (status) params.set('status', status);
            const data = await apiFetch<{ orders: OrderRow[]; total: number }>(`/orders?${params}`);
            setOrders(data.orders);
            setTotal(data.total);
        } catch { /* empty */ } finally { setLoading(false); }
    };

    const statusColor = (s: string) => {
        if (s === 'paid') return 'bg-emerald-500/10 text-emerald-400';
        if (s === 'refunded' || s === 'voided') return 'bg-red-500/10 text-red-400';
        return 'bg-amber-500/10 text-amber-400';
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Orders</h1>
                <p className="text-white/40 mt-1">Internal order pipeline — imported from connected stores</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                    className="input-field w-auto text-sm">
                    <option value="">All Statuses</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="refunded">Refunded</option>
                    <option value="partially_refunded">Partially Refunded</option>
                </select>
                <span className="text-white/30 text-sm self-center">{total} orders</span>
            </div>

            {/* Table */}
            <div className="card">
                {loading ? (
                    <p className="text-white/30 text-sm">Loading...</p>
                ) : orders.length === 0 ? (
                    <p className="text-white/30 text-sm">No orders found.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Order #</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Channel</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Payment</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Fulfillment</th>
                                    <th className="text-right py-3 px-2 text-white/40 font-medium">Total</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Date</th>
                                    <th className="text-right py-3 px-2 text-white/40 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((o) => (
                                    <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                        <td className="py-3 px-2 text-white font-mono text-xs">#{o.external_order_number}</td>
                                        <td className="py-3 px-2 text-white/50 text-xs">{o.channel}</td>
                                        <td className="py-3 px-2">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(o.financial_status)}`}>
                                                {o.financial_status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-white/50 text-xs">{o.fulfillment_status ?? 'unfulfilled'}</td>
                                        <td className="py-3 px-2 text-right text-white font-mono text-xs">
                                            {o.currency} {Number(o.total).toFixed(2)}
                                        </td>
                                        <td className="py-3 px-2 text-white/50 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                                        <td className="py-3 px-2 text-right">
                                            <a href={`/dashboard/ops/orders/${o.id}`}
                                                className="text-xs text-brand-400 hover:text-brand-300 transition-colors">View</a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                            className="text-xs text-brand-400 disabled:opacity-30">← Previous</button>
                        <span className="text-xs text-white/30">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                            className="text-xs text-brand-400 disabled:opacity-30">Next →</button>
                    </div>
                )}
            </div>
        </div>
    );
}
