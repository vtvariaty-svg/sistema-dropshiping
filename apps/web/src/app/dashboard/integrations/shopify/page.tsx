'use client';

import { useState, useEffect } from 'react';
import { apiFetch, getAccessToken } from '@/lib/api';

interface Store {
    id: string;
    shop_domain: string;
    scopes: string;
    status: string;
    created_at: string;
    updated_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function ShopifyIntegrationPage() {
    const [stores, setStores] = useState<Store[]>([]);
    const [shopDomain, setShopDomain] = useState('');
    const [loading, setLoading] = useState(true);
    const [registering, setRegistering] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    useEffect(() => {
        loadStores();
    }, []);

    const loadStores = async () => {
        try {
            const data = await apiFetch<Store[]>('/shopify/stores');
            setStores(data);
        } catch {
            // no stores yet
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        if (!shopDomain.trim()) return;
        const token = getAccessToken();
        const domain = shopDomain.includes('.') ? shopDomain : `${shopDomain}.myshopify.com`;
        window.location.href = `${API_BASE}/integrations/shopify/install?shop=${encodeURIComponent(domain)}&token=${token}`;
    };

    const handleRegisterWebhooks = async (storeId: string) => {
        setRegistering(storeId);
        setMessage('');
        try {
            await apiFetch(`/shopify/stores/${storeId}/register-webhooks`, { method: 'POST' });
            setMessage('Webhooks registrados com sucesso!');
        } catch (err) {
            setMessage('Falha ao registrar webhooks');
        } finally {
            setRegistering(null);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Integração Shopify</h1>
                <p className="text-white/40 mt-1">Conecte suas lojas Shopify e gerencie webhooks</p>
            </div>

            {/* Connect Store */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Conectar uma Loja Shopify</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text"
                        value={shopDomain}
                        onChange={(e) => setShopDomain(e.target.value)}
                        placeholder="minhaloja.myshopify.com"
                        className="input-field flex-1"
                    />
                    <button onClick={handleConnect} className="btn-primary whitespace-nowrap">
                        Conectar Loja
                    </button>
                </div>
            </div>

            {message && (
                <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm">
                    {message}
                </div>
            )}

            {/* Stores List */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Lojas Conectadas</h2>
                    <a href="/dashboard/integrations/shopify/inbox" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
                        Ver Caixa de Entrada de Webhooks →
                    </a>
                </div>

                {loading ? (
                    <p className="text-white/30 text-sm">Carregando...</p>
                ) : stores.length === 0 ? (
                    <p className="text-white/30 text-sm">Nenhuma loja conectada ainda.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Loja</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Status</th>
                                    <th className="text-left py-3 px-2 text-white/40 font-medium">Conectada</th>
                                    <th className="text-right py-3 px-2 text-white/40 font-medium">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stores.map((store) => (
                                    <tr key={store.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                        <td className="py-3 px-2 text-white font-mono text-xs">{store.shop_domain}</td>
                                        <td className="py-3 px-2">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${store.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                                }`}>
                                                {store.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-white/50 text-xs">
                                            {new Date(store.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-2 text-right">
                                            <button
                                                onClick={() => handleRegisterWebhooks(store.id)}
                                                disabled={registering === store.id}
                                                className="text-xs text-brand-400 hover:text-brand-300 disabled:opacity-50 transition-colors"
                                            >
                                                {registering === store.id ? 'Registrando...' : 'Registrar Webhooks'}
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
