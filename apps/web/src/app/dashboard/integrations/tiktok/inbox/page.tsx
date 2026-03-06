'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface TikTokWebhook {
    id: string;
    event_type: string;
    event_id: string | null;
    received_at: string;
    processed_at: string | null;
    status: string;
    error: string | null;
}

export default function TikTokWebhookInboxPage() {
    const [webhooks, setWebhooks] = useState<TikTokWebhook[]>([]);
    const [loading, setLoading] = useState(true);
    const [retrying, setRetrying] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadWebhooks();
    }, []);

    const loadWebhooks = async () => {
        try {
            const data = await apiFetch<TikTokWebhook[]>('/tiktok/webhooks');
            setWebhooks(data);
        } catch {
            // no webhooks yet
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = async (id: string) => {
        setRetrying(id);
        setMessage('');
        try {
            await apiFetch(`/tiktok/webhooks/${id}/retry`, { method: 'POST' });
            setMessage('✅ Reprocessamento enfileirado!');
            loadWebhooks();
        } catch {
            setMessage('❌ Falha no reprocessamento');
        } finally {
            setRetrying(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PROCESSED': return 'bg-emerald-500/10 text-emerald-400';
            case 'RECEIVED': return 'bg-yellow-500/10 text-yellow-400';
            case 'FAILED': return 'bg-red-500/10 text-red-400';
            default: return 'bg-white/10 text-white/50';
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <a href="/dashboard/integrations/tiktok" className="text-brand-400 hover:text-brand-300 text-sm">
                        ← TikTok Shop
                    </a>
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">📨 TikTok Webhook Inbox</h1>
                <p className="text-white/40 mt-1">Eventos recebidos do TikTok Shop</p>
            </div>

            {message && (
                <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm">
                    {message}
                </div>
            )}

            <div className="card">
                {loading ? (
                    <p className="text-white/30 text-sm">Carregando...</p>
                ) : webhooks.length === 0 ? (
                    <p className="text-white/30 text-sm">Nenhum webhook TikTok recebido ainda.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Tipo de Evento</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Recebido em</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Status</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Erro</th>
                                    <th className="text-right py-3 px-2 text-white/40 font-medium">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {webhooks.map((wh) => (
                                    <tr key={wh.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                        <td className="py-3 px-2 text-white font-mono text-xs">
                                            {wh.event_type}
                                        </td>
                                        <td className="py-3 px-2 text-white/50 text-xs">
                                            {new Date(wh.received_at).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="py-3 px-2">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(wh.status)}`}>
                                                {wh.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-red-400/70 text-xs max-w-[200px] truncate">
                                            {wh.error || '—'}
                                        </td>
                                        <td className="py-3 px-2 text-right">
                                            {wh.status === 'FAILED' && (
                                                <button
                                                    onClick={() => handleRetry(wh.id)}
                                                    disabled={retrying === wh.id}
                                                    className="text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50 transition-colors"
                                                >
                                                    {retrying === wh.id ? 'Reprocessando...' : '🔄 Reprocessar'}
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
