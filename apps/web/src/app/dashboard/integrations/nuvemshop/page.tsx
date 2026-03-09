'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface NuvemshopStore {
    id: string;
    store_id: string;
    name: string;
    status: string;
    created_at: string;
}

export default function NuvemshopIntegration() {
    const [stores, setStores] = useState<NuvemshopStore[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Check for URL parameters from OAuth callback
        const params = new URLSearchParams(window.location.search);
        if (params.get('success')) {
            setMessage('✅ Loja Nuvemshop conectada com sucesso!');
            // Clean URL
            window.history.replaceState({}, '', '/dashboard/integrations/nuvemshop');
        } else if (params.get('error')) {
            setMessage(`❌ Falha na conexão: ${params.get('error')}`);
            window.history.replaceState({}, '', '/dashboard/integrations/nuvemshop');
        }

        loadStores();
    }, []);

    const loadStores = async () => {
        try {
            const data = await apiFetch<NuvemshopStore[]>('/nuvemshop/stores');
            setStores(data);
        } catch { } // fail silently for now
        finally { setLoading(false); }
    };

    const handleConnect = async () => {
        try {
            const data = await apiFetch<{ url: string }>('/nuvemshop/auth/install');
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            setMessage(`❌ Erro ao iniciar conexão: ${err instanceof Error ? err.message : 'Desconhecido'}`);
        }
    };

    const handleDisconnect = async (id: string) => {
        if (!confirm('Deseja realmente desconectar esta loja? Os produtos pararão de sincronizar.')) return;
        try {
            await apiFetch(`/nuvemshop/stores/${id}`, { method: 'DELETE' });
            setMessage('✅ Loja desconectada.');
            loadStores();
        } catch {
            setMessage('❌ Erro ao desconectar loja.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-2">
                        🛍️ Nuvemshop
                    </h1>
                    <p className="text-white/40 mt-1">Conecte sua loja Tiendanube para sincronização de produtos e pedidos</p>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl text-sm ${message.includes('❌') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-brand-500/10 border border-brand-500/20 text-brand-300'}`}>
                    {message}
                </div>
            )}

            <div className="card space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-6">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Lojas Conectadas</h2>
                        <p className="text-sm text-white/40">Sincronize automaticamente os pedidos e atualizações de produto.</p>
                    </div>
                    <button onClick={handleConnect} className="btn-primary flex items-center gap-2">
                        <span>+ Conectar Nuvemshop</span>
                    </button>
                </div>

                {loading ? (
                    <p className="text-white/30 text-sm">Carregando lojas...</p>
                ) : stores.length === 0 ? (
                    <div className="py-8 text-center text-white/30 text-sm border border-dashed border-white/10 rounded-xl">
                        Nenhuma loja Nuvemshop conectada.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {stores.map(store => (
                            <div key={store.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                                <div>
                                    <h3 className="text-white font-medium">{store.name}</h3>
                                    <p className="text-white/40 text-xs mt-1 font-mono">ID: {store.store_id} • Status: <span className="text-emerald-400">Ativo</span></p>
                                </div>
                                <button
                                    onClick={() => handleDisconnect(store.id)}
                                    className="text-sm text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    Desconectar
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="card bg-brand-500/5 border-brand-500/20">
                <h3 className="text-brand-400 font-medium mb-2">Instruções para Conexão</h3>
                <ul className="text-white/50 text-sm space-y-2 list-disc list-inside">
                    <li>Ao clicar em Conectar, você será redirecionado para a plataforma da Nuvemshop.</li>
                    <li>Faça login na sua conta de Lojista se for solicitado.</li>
                    <li>Aceite as permissões para que o sistema possa gerenciar Produtos, Pedidos e Webhooks em seu nome.</li>
                    <li>O painel automaticamente fará a captura das vendas realizadas por lá e atualizará seu catálogo.</li>
                </ul>
            </div>
        </div>
    );
}
