'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface OrderDetail {
    id: string; external_order_number: string; external_order_id: string;
    channel: string; store_id: string | null;
    financial_status: string; fulfillment_status: string | null;
    currency: string; subtotal: string; shipping: string; discounts: string; total: string;
    created_at: string; updated_at: string;
    items: Array<{ id: string; title: string; sku: string | null; qty: number; price: string; discount: string }>;
    addresses: Array<{
        id: string; type: string; name: string | null; phone: string | null;
        address1: string | null; city: string | null; province: string | null; zip: string | null; country: string | null;
    }>;
    events: Array<{ id: string; type: string; channel: string; payload_json: unknown; created_at: string }>;
}

export default function OrderDetailPage() {
    const params = useParams();
    const orderId = params.id as string;
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [reimporting, setReimporting] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => { loadOrder(); }, [orderId]);

    const loadOrder = async () => {
        try {
            const data = await apiFetch<OrderDetail>(`/orders/${orderId}`);
            setOrder(data);
        } catch { /* empty */ } finally { setLoading(false); }
    };

    const handleReimport = async () => {
        setReimporting(true); setMessage('');
        try {
            await apiFetch(`/orders/${orderId}/reimport`, { method: 'POST' });
            setMessage('Reimport enqueued — order will be refreshed shortly.');
        } catch { setMessage('Reimport failed'); } finally { setReimporting(false); }
    };

    if (loading) return <div className="text-white/30">Loading...</div>;
    if (!order) return <div className="text-red-400">Order not found</div>;

    const shipping = order.addresses.find((a) => a.type === 'shipping');
    const billing = order.addresses.find((a) => a.type === 'billing');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <a href="/dashboard/ops/orders" className="text-sm text-brand-400 hover:text-brand-300">← Back to Orders</a>
                    <h1 className="text-2xl font-bold text-white mt-1">Order #{order.external_order_number}</h1>
                </div>
                <button onClick={handleReimport} disabled={reimporting}
                    className="btn-primary text-sm disabled:opacity-50">
                    {reimporting ? 'Reimporting...' : '🔄 Reimport Order'}
                </button>
            </div>

            {message && <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm">{message}</div>}

            {/* Summary */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="text-white/40 block">Channel</span><span className="text-white">{order.channel}</span></div>
                    <div><span className="text-white/40 block">Payment</span><span className="text-white">{order.financial_status}</span></div>
                    <div><span className="text-white/40 block">Fulfillment</span><span className="text-white">{order.fulfillment_status ?? 'unfulfilled'}</span></div>
                    <div><span className="text-white/40 block">Total</span><span className="text-white font-mono">{order.currency} {Number(order.total).toFixed(2)}</span></div>
                    <div><span className="text-white/40 block">Subtotal</span><span className="text-white font-mono">{Number(order.subtotal).toFixed(2)}</span></div>
                    <div><span className="text-white/40 block">Shipping</span><span className="text-white font-mono">{Number(order.shipping).toFixed(2)}</span></div>
                    <div><span className="text-white/40 block">Discounts</span><span className="text-white font-mono">-{Number(order.discounts).toFixed(2)}</span></div>
                    <div><span className="text-white/40 block">Date</span><span className="text-white">{new Date(order.created_at).toLocaleString()}</span></div>
                </div>
            </div>

            {/* Line Items */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Items ({order.items.length})</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left py-2 px-2 text-white/40">Title</th>
                                <th className="text-left py-2 px-2 text-white/40">SKU</th>
                                <th className="text-right py-2 px-2 text-white/40">Qty</th>
                                <th className="text-right py-2 px-2 text-white/40">Price</th>
                                <th className="text-right py-2 px-2 text-white/40">Discount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.items.map((item) => (
                                <tr key={item.id} className="border-b border-white/5">
                                    <td className="py-2 px-2 text-white text-xs">{item.title}</td>
                                    <td className="py-2 px-2 text-white/50 font-mono text-xs">{item.sku ?? '—'}</td>
                                    <td className="py-2 px-2 text-right text-white text-xs">{item.qty}</td>
                                    <td className="py-2 px-2 text-right text-white font-mono text-xs">{Number(item.price).toFixed(2)}</td>
                                    <td className="py-2 px-2 text-right text-red-400/70 font-mono text-xs">-{Number(item.discount).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
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
                {order.events.length === 0 ? (
                    <p className="text-white/30 text-sm">No events.</p>
                ) : (
                    <div className="space-y-2">
                        {order.events.map((ev) => (
                            <div key={ev.id} className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                                <div>
                                    <span className="text-white font-medium">{ev.type}</span>
                                    <span className="text-white/30 ml-2">{ev.channel}</span>
                                </div>
                                <span className="text-white/40 text-xs">{new Date(ev.created_at).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
