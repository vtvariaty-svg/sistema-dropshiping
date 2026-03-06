'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface PODetail {
    id: string; status: string; currency: string; total_cost: string;
    created_at: string; updated_at: string; sent_at: string | null; last_error: string | null;
    supplier: { id: string; name: string; contact_email: string | null };
    order: { id: string; external_order_number: string; addresses: Array<{ type: string; name: string | null; phone: string | null; address1: string | null; city: string | null; province: string | null; zip: string | null; country: string | null }> };
    items: Array<{ id: string; supplier_sku: string; title: string; qty: number; unit_cost: string; line_total: string }>;
    artifacts: Array<{ id: string; type: string; created_at: string }>;
    events: Array<{ id: string; type: string; payload_json: unknown; created_at: string }>;
}

interface Tracking { id: string; carrier: string | null; tracking_code: string; tracking_url: string | null; status: string; created_at: string; }
interface SyncLog { id: string; attempt: number; status: string; error: string | null; created_at: string; }

export default function PODetailPage() {
    const params = useParams();
    const poId = params.id as string;
    const [po, setPO] = useState<PODetail | null>(null);
    const [tracking, setTracking] = useState<Tracking | null>(null);
    const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(false);
    const [message, setMessage] = useState('');
    const [showTrackingForm, setShowTrackingForm] = useState(false);
    const [trackForm, setTrackForm] = useState({ carrier: '', tracking_code: '', tracking_url: '' });

    useEffect(() => { load(); }, [poId]);

    const load = async () => {
        try {
            const [poData, logs] = await Promise.all([
                apiFetch<PODetail>(`/purchase-orders/${poId}`),
                apiFetch<SyncLog[]>(`/purchase-orders/${poId}/fulfillment-sync-logs`),
            ]);
            setPO(poData); setSyncLogs(logs);
            try { setTracking(await apiFetch<Tracking>(`/purchase-orders/${poId}/tracking`)); } catch { setTracking(null); }
        } catch { } finally { setLoading(false); }
    };

    const act = async (action: string) => {
        setActing(true); setMessage('');
        try { await apiFetch(`/purchase-orders/${poId}/${action}`, { method: 'POST' }); setMessage(`${action} done`); load(); }
        catch (e) { setMessage(`Failed: ${e}`); } finally { setActing(false); }
    };

    const submitTracking = async () => {
        setActing(true); setMessage('');
        try {
            await apiFetch(`/purchase-orders/${poId}/tracking`, { method: 'POST', body: JSON.stringify(trackForm) });
            setMessage('Tracking registered & sync enqueued'); setShowTrackingForm(false); load();
        } catch (e) { setMessage(`Failed: ${e}`); } finally { setActing(false); }
    };

    const download = (artifactId: string) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
        window.open(`${baseUrl}/purchase-orders/${poId}/artifacts/${artifactId}/download?token=${token}`, '_blank');
    };

    if (loading) return <div className="text-white/30">Loading...</div>;
    if (!po) return <div className="text-red-400">PO not found</div>;

    const shipping = po.order.addresses.find((a) => a.type === 'shipping');
    const stColor = (s: string) => {
        if (s === 'DISPATCHED' || s === 'SHIPPED') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (s === 'READY_TO_DISPATCH') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (s === 'CANCELLED') return 'bg-red-500/10 text-red-400 border-red-500/20';
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <a href="/dashboard/ops/purchase-orders" className="text-sm text-brand-400 hover:text-brand-300">← Back to POs</a>
                    <h1 className="text-2xl font-bold text-white mt-1">Purchase Order</h1>
                    <p className="text-white/40 text-xs font-mono mt-0.5">{po.id}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {po.status === 'CREATED' && (
                        <button onClick={() => act('generate-artifacts')} disabled={acting} className="btn-primary text-sm disabled:opacity-50">📄 Generate Artifacts</button>
                    )}
                    {po.status === 'READY_TO_DISPATCH' && (
                        <button onClick={() => act('dispatch')} disabled={acting} className="btn-primary text-sm disabled:opacity-50">🚀 Dispatch</button>
                    )}
                    {(po.status === 'DISPATCHED' || po.status === 'SHIPPED') && (
                        <button onClick={() => setShowTrackingForm(true)} className="btn-primary text-sm">📦 Add Tracking</button>
                    )}
                    {po.status !== 'DISPATCHED' && po.status !== 'SHIPPED' && po.status !== 'CANCELLED' && (
                        <button onClick={() => act('cancel')} disabled={acting} className="text-sm px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50">Cancel</button>
                    )}
                </div>
            </div>

            {message && <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm">{message}</div>}

            {/* Summary */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="text-white/40 block">Status</span>
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${stColor(po.status)}`}>{po.status}</span>
                    </div>
                    <div><span className="text-white/40 block">Total Cost</span><span className="text-white font-mono">{po.currency} {Number(po.total_cost).toFixed(2)}</span></div>
                    <div><span className="text-white/40 block">Created</span><span className="text-white">{new Date(po.created_at).toLocaleString()}</span></div>
                    <div><span className="text-white/40 block">Sent</span><span className="text-white">{po.sent_at ? new Date(po.sent_at).toLocaleString() : '—'}</span></div>
                </div>
            </div>

            {/* Tracking */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Tracking</h2>
                {showTrackingForm && (
                    <div className="space-y-3 mb-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input className="input-field" placeholder="Carrier (optional)" value={trackForm.carrier} onChange={(e) => setTrackForm({ ...trackForm, carrier: e.target.value })} />
                            <input className="input-field" placeholder="Tracking Code *" value={trackForm.tracking_code} onChange={(e) => setTrackForm({ ...trackForm, tracking_code: e.target.value })} />
                            <input className="input-field" placeholder="Tracking URL (optional)" value={trackForm.tracking_url} onChange={(e) => setTrackForm({ ...trackForm, tracking_url: e.target.value })} />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={submitTracking} disabled={acting || !trackForm.tracking_code} className="btn-primary text-sm disabled:opacity-50">Submit & Sync</button>
                            <button onClick={() => setShowTrackingForm(false)} className="text-sm text-white/40 hover:text-white/60">Cancel</button>
                        </div>
                    </div>
                )}
                {tracking ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><span className="text-white/40 block">Carrier</span><span className="text-white">{tracking.carrier ?? '—'}</span></div>
                        <div><span className="text-white/40 block">Code</span><span className="text-white font-mono">{tracking.tracking_code}</span></div>
                        <div><span className="text-white/40 block">URL</span>
                            {tracking.tracking_url ? <a href={tracking.tracking_url} target="_blank" rel="noreferrer" className="text-brand-400 text-xs hover:text-brand-300">Track →</a> : <span className="text-white/30">—</span>}
                        </div>
                        <div><span className="text-white/40 block">Sync Status</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${tracking.status === 'SYNCED' ? 'bg-emerald-500/10 text-emerald-400' : tracking.status === 'FAILED' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{tracking.status}</span>
                        </div>
                    </div>
                ) : <p className="text-white/30 text-sm">No tracking registered.</p>}
            </div>

            {/* Supplier + Order */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card">
                    <h2 className="text-lg font-semibold text-white mb-3">Supplier</h2>
                    <div className="text-sm space-y-1">
                        <p className="text-white font-medium">{po.supplier.name}</p>
                        {po.supplier.contact_email && <p className="text-white/50">{po.supplier.contact_email}</p>}
                    </div>
                </div>
                <div className="card">
                    <h2 className="text-lg font-semibold text-white mb-3">Order & Shipping</h2>
                    <div className="text-sm space-y-1">
                        <p className="text-white font-medium">Order #{po.order.external_order_number}</p>
                        <a href={`/dashboard/ops/orders/${po.order.id}`} className="text-brand-400 text-xs hover:text-brand-300">View Order →</a>
                        {shipping && (
                            <div className="mt-2 text-white/50">
                                {shipping.name && <p>{shipping.name}</p>}
                                {shipping.address1 && <p>{shipping.address1}</p>}
                                {shipping.city && <p>{[shipping.city, shipping.province, shipping.zip].filter(Boolean).join(', ')}</p>}
                                {shipping.country && <p>{shipping.country}</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Items */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Items ({po.items.length})</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-white/10">
                            <th className="text-left py-2 px-2 text-white/40">Supplier SKU</th>
                            <th className="text-left py-2 px-2 text-white/40">Title</th>
                            <th className="text-right py-2 px-2 text-white/40">Qty</th>
                            <th className="text-right py-2 px-2 text-white/40">Unit Cost</th>
                            <th className="text-right py-2 px-2 text-white/40">Line Total</th>
                        </tr></thead>
                        <tbody>{po.items.map((item) => (
                            <tr key={item.id} className="border-b border-white/5">
                                <td className="py-2 px-2 text-white font-mono text-xs">{item.supplier_sku}</td>
                                <td className="py-2 px-2 text-white text-xs">{item.title}</td>
                                <td className="py-2 px-2 text-right text-white text-xs">{item.qty}</td>
                                <td className="py-2 px-2 text-right text-white font-mono text-xs">{Number(item.unit_cost).toFixed(2)}</td>
                                <td className="py-2 px-2 text-right text-white font-mono text-xs">{Number(item.line_total).toFixed(2)}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </div>

            {/* Artifacts */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Artifacts ({po.artifacts.length})</h2>
                {po.artifacts.length === 0 ? <p className="text-white/30 text-sm">No artifacts generated.</p> : (
                    <div className="space-y-2">
                        {po.artifacts.map((a) => (
                            <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-medium text-sm">{a.type}</span>
                                    <span className="text-white/30 text-xs">{new Date(a.created_at).toLocaleString()}</span>
                                </div>
                                <button onClick={() => download(a.id)} className="text-xs text-brand-400 hover:text-brand-300">Download</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Fulfillment Sync Logs */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Fulfillment Sync Logs ({syncLogs.length})</h2>
                {syncLogs.length === 0 ? <p className="text-white/30 text-sm">No sync attempts.</p> : (
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
                )}
            </div>

            {/* Events */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Events ({po.events.length})</h2>
                {po.events.length === 0 ? <p className="text-white/30 text-sm">No events.</p> : (
                    <div className="space-y-2">
                        {po.events.map((ev) => (
                            <div key={ev.id} className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                                <span className="text-white font-medium">{ev.type}</span>
                                <span className="text-white/40 text-xs">{new Date(ev.created_at).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
