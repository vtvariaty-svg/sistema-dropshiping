'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface OrderDetail {
    id: string; external_order_number: string; external_order_id: string;
    channel: string; store_id: string | null; operational_status: string | null;
    financial_status: string; fulfillment_status: string | null;
    currency: string; subtotal: string; shipping: string; discounts: string; total: string;
    created_at: string; updated_at: string;
    items: Array<{ id: string; title: string; sku: string | null; variant_id: string | null; qty: number; price: string; discount: string }>;
    addresses: Array<{ id: string; type: string; name: string | null; phone: string | null; address1: string | null; city: string | null; province: string | null; zip: string | null; country: string | null }>;
    events: Array<{ id: string; type: string; channel: string; payload_json: unknown; created_at: string }>;
    purchase_orders?: Array<{ id: string; status: string; total_cost: string; supplier: { name: string } }>;
}

interface SyncLog { id: string; attempt: number; status: string; error: string | null; created_at: string; }
interface Profit { revenue: string; cogs: string; fees: string; shipping: string; ads_cost: string; net_profit: string; margin_percent: string; calculated_at: string; }

export default function OrderDetailPage() {
    const params = useParams();
    const orderId = params.id as string;
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
    const [profit, setProfit] = useState<Profit | null>(null);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => { loadOrder(); }, [orderId]);

    const loadOrder = async () => {
        try {
            const [data, logs] = await Promise.all([
                apiFetch<OrderDetail>(`/orders/${orderId}`),
                apiFetch<SyncLog[]>(`/orders/${orderId}/fulfillment-sync-logs`),
            ]);
            setOrder(data); setSyncLogs(logs);
            try { setProfit(await apiFetch<Profit>(`/orders/${orderId}/profit`)); } catch { setProfit(null); }
        } catch { } finally { setLoading(false); }
    };

    const handleAction = async (action: string) => {
        setActing(true); setMessage('');
        try {
            await apiFetch(`/orders/${orderId}/${action}`, { method: 'POST' });
            setMessage(`${action} completed.`); loadOrder();
        } catch (e) { setMessage(`Failed: ${e}`); } finally { setActing(false); }
    };

    if (loading) return <div className="text-white/30">Loading...</div>;
    if (!order) return <div className="text-red-400">Order not found</div>;

    const shipping = order.addresses.find((a) => a.type === 'shipping');
    const billing = order.addresses.find((a) => a.type === 'billing');
    const opColor = (s: string | null) => {
        if (s === 'FULFILLED') return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        if (s === 'IN_FULFILLMENT') return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
        if (s === 'PO_CREATED') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (s === 'READY_FOR_PO') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (s === 'NEEDS_MAPPING') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
        return 'bg-white/5 text-white/40 border-white/10';
    };

    const statusSteps = ['NEW', 'NEEDS_MAPPING', 'READY_FOR_PO', 'PO_CREATED', 'IN_FULFILLMENT', 'FULFILLED'];
    const currentStep = statusSteps.indexOf(order.operational_status ?? 'NEW');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <a href="/dashboard/ops/orders" className="text-sm text-brand-400 hover:text-brand-300">← Back to Orders</a>
                    <h1 className="text-2xl font-bold text-white mt-1">Order #{order.external_order_number}</h1>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {order.operational_status === 'READY_FOR_PO' && (
                        <button onClick={() => handleAction('create-po')} disabled={acting} className="btn-primary text-sm disabled:opacity-50">🛒 Create Purchase Order</button>
                    )}
                    {(order.operational_status === 'IN_FULFILLMENT' || order.operational_status === 'PO_CREATED') && (
                        <button onClick={() => handleAction('push-fulfillment')} disabled={acting} className="btn-primary text-sm disabled:opacity-50">📡 Push Fulfillment</button>
                    )}
                    <button onClick={() => handleAction('reconcile-mapping')} disabled={acting} className="btn-secondary text-sm disabled:opacity-50">🔍 Reconcile</button>
                    <button onClick={() => handleAction('reimport')} disabled={acting} className="text-sm px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 disabled:opacity-50">🔄 Reimport</button>
                </div>
            </div>

            {message && <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm">{message}</div>}

            {/* Pipeline Progress */}
            <div className="card">
                <h2 className="text-sm font-semibold text-white/40 mb-3 uppercase tracking-wider">Pipeline Progress</h2>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {statusSteps.map((step, i) => (
                        <div key={step} className="flex items-center">
                            <div className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${i <= currentStep ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30' : 'bg-white/5 text-white/20 border border-white/5'}`}>
                                {step.replace(/_/g, ' ')}
                            </div>
                            {i < statusSteps.length - 1 && <div className={`w-4 h-px ${i < currentStep ? 'bg-brand-500/50' : 'bg-white/10'}`} />}
                        </div>
                    ))}
                </div>
            </div>

            {order.operational_status === 'NEEDS_MAPPING' && (
                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                        <p className="text-orange-300 font-medium">This order needs SKU mapping</p>
                        <p className="text-orange-300/60 text-sm">Go to SKU Mappings to configure, then reconcile.</p>
                    </div>
                </div>
            )}

            {/* Summary */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="text-white/40 block">Channel</span><span className="text-white">{order.channel}</span></div>
                    <div><span className="text-white/40 block">Payment</span><span className="text-white">{order.financial_status}</span></div>
                    <div><span className="text-white/40 block">Pipeline</span>
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${opColor(order.operational_status)}`}>{order.operational_status ?? 'NEW'}</span>
                    </div>
                    <div><span className="text-white/40 block">Total</span><span className="text-white font-mono">{order.currency} {Number(order.total).toFixed(2)}</span></div>
                    <div><span className="text-white/40 block">Subtotal</span><span className="text-white font-mono">{Number(order.subtotal).toFixed(2)}</span></div>
                    <div><span className="text-white/40 block">Shipping</span><span className="text-white font-mono">{Number(order.shipping).toFixed(2)}</span></div>
                    <div><span className="text-white/40 block">Discounts</span><span className="text-white font-mono">-{Number(order.discounts).toFixed(2)}</span></div>
                    <div><span className="text-white/40 block">Date</span><span className="text-white">{new Date(order.created_at).toLocaleString()}</span></div>
                </div>
            </div>

            {/* Profitability */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Profitability</h2>
                    <button onClick={() => handleAction('recalculate-profit')} disabled={acting} className="text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50">🔄 Recalculate</button>
                </div>
                {profit ? (() => {
                    const margin = Number(profit.margin_percent);
                    const mColor = margin >= 20 ? 'text-emerald-400' : margin >= 0 ? 'text-amber-400' : 'text-red-400';
                    return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div><span className="text-white/40 block">Revenue</span><span className="text-white font-mono">{Number(profit.revenue).toFixed(2)}</span></div>
                            <div><span className="text-white/40 block">COGS</span><span className="text-red-400/70 font-mono">-{Number(profit.cogs).toFixed(2)}</span></div>
                            <div><span className="text-white/40 block">Fees</span><span className="text-orange-400/70 font-mono">-{Number(profit.fees).toFixed(2)}</span></div>
                            <div><span className="text-white/40 block">Shipping</span><span className="text-blue-400/70 font-mono">-{Number(profit.shipping).toFixed(2)}</span></div>
                            <div><span className="text-white/40 block">Ads Cost</span><span className="text-white/50 font-mono">-{Number(profit.ads_cost).toFixed(2)}</span></div>
                            <div><span className="text-white/40 block">Net Profit</span><span className={`font-mono font-bold ${mColor}`}>{Number(profit.net_profit).toFixed(2)}</span></div>
                            <div><span className="text-white/40 block">Margin</span><span className={`font-mono font-bold ${mColor}`}>{margin.toFixed(1)}%</span></div>
                            <div><span className="text-white/40 block">Calculated</span><span className="text-white/50 text-xs">{new Date(profit.calculated_at).toLocaleString()}</span></div>
                        </div>
                    );
                })() : <p className="text-white/30 text-sm">No profit data. Click Recalculate.</p>}
            </div>

            {/* Purchase Orders */}
            {order.purchase_orders && order.purchase_orders.length > 0 && (
                <div className="card">
                    <h2 className="text-lg font-semibold text-white mb-4">Purchase Orders ({order.purchase_orders.length})</h2>
                    <div className="space-y-2">
                        {order.purchase_orders.map((po) => (
                            <div key={po.id} className="flex items-center justify-between py-2 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <span className="text-white/70 text-sm">{po.supplier.name}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${['DISPATCHED', 'SHIPPED'].includes(po.status) ? 'bg-emerald-500/10 text-emerald-400' : po.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{po.status}</span>
                                    <span className="text-white/40 font-mono text-xs">{Number(po.total_cost).toFixed(2)}</span>
                                </div>
                                <a href={`/dashboard/ops/purchase-orders/${po.id}`} className="text-xs text-brand-400 hover:text-brand-300">View PO →</a>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Fulfillment Sync Logs */}
            {syncLogs.length > 0 && (
                <div className="card">
                    <h2 className="text-lg font-semibold text-white mb-4">Fulfillment Sync Logs ({syncLogs.length})</h2>
                    <div className="space-y-2">
                        {syncLogs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                                <div className="flex items-center gap-3">
                                    <span className="text-white/40 text-xs">#{log.attempt}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${log.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{log.status}</span>
                                    {log.error && <span className="text-red-400/60 text-xs truncate max-w-[300px]">{log.error}</span>}
                                </div>
                                <span className="text-white/40 text-xs">{new Date(log.created_at).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Line Items */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Items ({order.items.length})</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-white/10">
                            <th className="text-left py-2 px-2 text-white/40">Title</th>
                            <th className="text-left py-2 px-2 text-white/40">SKU</th>
                            <th className="text-left py-2 px-2 text-white/40">Variant</th>
                            <th className="text-right py-2 px-2 text-white/40">Qty</th>
                            <th className="text-right py-2 px-2 text-white/40">Price</th>
                        </tr></thead>
                        <tbody>{order.items.map((item) => (
                            <tr key={item.id} className="border-b border-white/5">
                                <td className="py-2 px-2 text-white text-xs">{item.title}</td>
                                <td className="py-2 px-2 text-white/50 font-mono text-xs">{item.sku ?? '—'}</td>
                                <td className="py-2 px-2 text-white/50 font-mono text-xs">{item.variant_id ?? '—'}</td>
                                <td className="py-2 px-2 text-right text-white text-xs">{item.qty}</td>
                                <td className="py-2 px-2 text-right text-white font-mono text-xs">{Number(item.price).toFixed(2)}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shipping && (
                    <div className="card">
                        <h2 className="text-lg font-semibold text-white mb-3">Shipping Address</h2>
                        <div className="text-sm text-white/70 space-y-1">
                            {shipping.name && <p className="text-white font-medium">{shipping.name}</p>}
                            {shipping.address1 && <p>{shipping.address1}</p>}
                            {shipping.city && <p>{[shipping.city, shipping.province, shipping.zip].filter(Boolean).join(', ')}</p>}
                            {shipping.country && <p>{shipping.country}</p>}
                            {shipping.phone && <p className="text-white/40">📞 {shipping.phone}</p>}
                        </div>
                    </div>
                )}
                {billing && (
                    <div className="card">
                        <h2 className="text-lg font-semibold text-white mb-3">Billing Address</h2>
                        <div className="text-sm text-white/70 space-y-1">
                            {billing.name && <p className="text-white font-medium">{billing.name}</p>}
                            {billing.address1 && <p>{billing.address1}</p>}
                            {billing.city && <p>{[billing.city, billing.province, billing.zip].filter(Boolean).join(', ')}</p>}
                            {billing.country && <p>{billing.country}</p>}
                        </div>
                    </div>
                )}
            </div>

            {/* Events */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Events ({order.events.length})</h2>
                {order.events.length === 0 ? <p className="text-white/30 text-sm">No events.</p> : (
                    <div className="space-y-2">
                        {order.events.map((ev) => (
                            <div key={ev.id} className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                                <div><span className="text-white font-medium">{ev.type}</span><span className="text-white/30 ml-2">{ev.channel}</span></div>
                                <span className="text-white/40 text-xs">{new Date(ev.created_at).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
