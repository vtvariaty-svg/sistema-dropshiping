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

export default function OrderDetailPage() {
    const params = useParams();
    const orderId = params.id as string;
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => { loadOrder(); }, [orderId]);

    const loadOrder = async () => {
        try { setOrder(await apiFetch<OrderDetail>(`/orders/${orderId}`)); } catch { } finally { setLoading(false); }
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
        if (s === 'READY_FOR_PO') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (s === 'NEEDS_MAPPING') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
        if (s === 'PO_CREATED') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (s === 'FULFILLED') return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
        return 'bg-white/5 text-white/40 border-white/10';
    };

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
                    <button onClick={() => handleAction('reconcile-mapping')} disabled={acting} className="btn-secondary text-sm disabled:opacity-50">🔍 Reconcile</button>
                    <button onClick={() => handleAction('reimport')} disabled={acting} className="text-sm px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 disabled:opacity-50">🔄 Reimport</button>
                </div>
            </div>

            {message && <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm">{message}</div>}

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

            {/* Purchase Orders */}
            {order.purchase_orders && order.purchase_orders.length > 0 && (
                <div className="card">
                    <h2 className="text-lg font-semibold text-white mb-4">Purchase Orders ({order.purchase_orders.length})</h2>
                    <div className="space-y-2">
                        {order.purchase_orders.map((po) => (
                            <div key={po.id} className="flex items-center justify-between py-2 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <span className="text-white/70 text-sm">{po.supplier.name}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${po.status === 'DISPATCHED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{po.status}</span>
                                    <span className="text-white/40 font-mono text-xs">{Number(po.total_cost).toFixed(2)}</span>
                                </div>
                                <a href={`/dashboard/ops/purchase-orders/${po.id}`} className="text-xs text-brand-400 hover:text-brand-300">View PO →</a>
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
