'use client';

import { useState, useEffect } from 'react';
import { apiFetch, getAccessToken } from '@/lib/api';

interface TikTokShop {
    id: string;
    shop_id: string | null;
    shop_name: string | null;
    region: string | null;
    status: string;
    token_expires_at: string | null;
    created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function TikTokIntegrationPage() {
    const [shops, setShops] = useState<TikTokShop[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadShops();
        // Check for connect/error query params
        const params = new URLSearchParams(window.location.search);
        if (params.get('connected') === 'true') {
            setMessage('✅ TikTok Shop conectada com sucesso!');
        }
        if (params.get('error')) {
            setMessage('❌ Falha na conexão com TikTok Shop. Tente novamente.');
        }
    }, []);

    const loadShops = async () => {
        try {
            const data = await apiFetch<TikTokShop[]>('/tiktok/shops');
            setShops(data);
        } catch {
            // no shops yet
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        const token = getAccessToken();
        window.location.href = `${API_BASE}/integrations/tiktok/install?token=${token}`;
    };

    const handleRefreshToken = async (shopId: string) => {
        setRefreshing(shopId);
        setMessage('');
        try {
            await apiFetch(`/tiktok/shops/${shopId}/refresh-token`, { method: 'POST' });
            setMessage('✅ Token renovado com sucesso!');
            loadShops();
        } catch {
            setMessage('❌ Falha ao renovar token');
        } finally {
            setRefreshing(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'bg-emerald-500/10 text-emerald-400';
            case 'EXPIRED': return 'bg-yellow-500/10 text-yellow-400';
            case 'REVOKED': return 'bg-red-500/10 text-red-400';
            default: return 'bg-white/10 text-white/50';
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">🎵 Integração TikTok Shop</h1>
                <p className="text-white/40 mt-1">Conecte suas lojas TikTok Shop e gerencie pedidos</p>
            </div>

            {/* Connect Store */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Conectar uma Loja TikTok Shop</h2>
                <p className="text-white/50 text-sm mb-4">
                    Clique no botão abaixo para autorizar o acesso à sua conta no TikTok Seller Center.
                </p>
                <button onClick={handleConnect} className="btn-primary">
                    🔗 Conectar TikTok Shop
                </button>
            </div>

            {message && (
                <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm">
                    {message}
                </div>
            )}

            {/* Shops List */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Lojas Conectadas</h2>
                    <div className="flex gap-3">
                        <a href="/dashboard/integrations/tiktok/inbox" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
                            📨 Webhook Inbox →
                        </a>
                    </div>
                </div>

                {loading ? (
                    <p className="text-white/30 text-sm">Carregando...</p>
                ) : shops.length === 0 ? (
                    <p className="text-white/30 text-sm">Nenhuma loja TikTok Shop conectada ainda.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Loja</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">ID</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Região</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Status</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Token Expira</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Conectada</th>
                                    <th className="text-right py-3 px-2 text-white/40 font-medium">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shops.map((shop) => (
                                    <tr key={shop.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                        <td className="py-3 px-2 text-white font-medium">
                                            {shop.shop_name || '—'}
                                        </td>
                                        <td className="py-3 px-2 text-white/50 font-mono text-xs">
                                            {shop.shop_id || '—'}
                                        </td>
                                        <td className="py-3 px-2 text-white/50 text-xs">
                                            {shop.region || '—'}
                                        </td>
                                        <td className="py-3 px-2">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(shop.status)}`}>
                                                {shop.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-white/50 text-xs">
                                            {shop.token_expires_at ? new Date(shop.token_expires_at).toLocaleDateString('pt-BR') : '—'}
                                        </td>
                                        <td className="py-3 px-2 text-white/50 text-xs">
                                            {new Date(shop.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="py-3 px-2 text-right space-x-3">
                                            <button
                                                onClick={() => handleRefreshToken(shop.id)}
                                                disabled={refreshing === shop.id}
                                                className="text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50 transition-colors"
                                            >
                                                {refreshing === shop.id ? 'Renovando...' : '🔄 Renovar Token'}
                                            </button>
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
