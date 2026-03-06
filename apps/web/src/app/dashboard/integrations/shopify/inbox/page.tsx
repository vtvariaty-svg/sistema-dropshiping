'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface WebhookEntry {
    id: string;
    topic: string;
    webhook_id: string;
    received_at: string;
    status: string;
    error: string | null;
    store_id: string;
}

export default function WebhookInboxPage() {
    const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState<string | null>(null);

    useEffect(() => { loadWebhooks(); }, []);

    const loadWebhooks = async () => {
        try {
            const data = await apiFetch<WebhookEntry[]>('/shopify/webhooks');
            setWebhooks(data);
        } catch { /* empty */ } finally { setLoading(false); }
    };

    const handleRetry = async (id: string) => {
        setRetrying(id);
        try {
            await apiFetch(`/shopify/webhooks/${id}/retry`, { method: 'POST' });
            await loadWebhooks();
        } catch { /* show inline */ } finally { setRetrying(null); }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case 'processed': return 'bg-emerald-500/10 text-emerald-400';
            case 'failed': return 'bg-red-500/10 text-red-400';
            default: return 'bg-amber-500/10 text-amber-400';
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-white">Webhook Inbox</h1>
                    <p className="text-white/40 mt-1">Incoming Shopify webhook events</p>
                </div>
                <a href="/dashboard/integrations/shopify" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
                    ← Back to Stores
                </a>
            </div>

            <div className="card">
                {loading ? (
                    <p className="text-white/30 text-sm">Loading...</p>
                ) : webhooks.length === 0 ? (
                    <p className="text-white/30 text-sm">No webhooks received yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Topic</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Received</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Status</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Error</th>
                                    <th className="text-right py-3 px-2 text-white/40 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {webhooks.map((wh) => (
                                    <tr key={wh.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                        <td className="py-3 px-2 text-white font-mono text-xs">{wh.topic}</td>
                                        <td className="py-3 px-2 text-white/50 text-xs">
                                            {new Date(wh.received_at).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-2">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(wh.status)}`}>
                                                {wh.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-red-400/70 text-xs max-w-[200px] truncate">
                                            {wh.error || '—'}
                                        </td>
                                        <td className="py-3 px-2 text-right">
                                            {wh.status === 'failed' && (
                                                <button
                                                    onClick={() => handleRetry(wh.id)}
                                                    disabled={retrying === wh.id}
                                                    className="text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50 transition-colors"
                                                >
                                                    {retrying === wh.id ? 'Retrying...' : 'Retry'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
