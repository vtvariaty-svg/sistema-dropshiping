'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { UserInfo } from './layout';

interface Stats {
    pendingOrders: number;
    activeProducts: number;
    supplierCount: number;
}

export default function DashboardPage() {
    const [user, setUser] = useState<UserInfo | null>(null);

    useEffect(() => {
        apiFetch<UserInfo>('/me').then(setUser).catch(() => { });
    }, []);

    const placeholderStats: Stats = {
        pendingOrders: 0,
        activeProducts: 0,
        supplierCount: 0,
    };

    return (
        <div className="space-y-8">
            {/* Welcome */}
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">
                    Bem-vindo de volta{user ? `, ${user.email.split('@')[0]}` : ''}
                </h1>
                <p className="text-white/40 mt-1">
                    {user?.tenant.name} &middot; <span className="capitalize">{user?.tenant.plan}</span>
                </p>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {[
                    { label: 'Pedidos Pendentes', value: placeholderStats.pendingOrders, icon: '📦', color: 'from-amber-500/20 to-amber-500/5' },
                    { label: 'Produtos Ativos', value: placeholderStats.activeProducts, icon: '🏷️', color: 'from-emerald-500/20 to-emerald-500/5' },
                    { label: 'Fornecedores', value: placeholderStats.supplierCount, icon: '🏭', color: 'from-blue-500/20 to-blue-500/5' },
                ].map((stat) => (
                    <div key={stat.label} className={`card bg-gradient-to-br ${stat.color} border-white/5`}>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-2xl">{stat.icon}</span>
                            <span className="text-xs text-white/30 uppercase tracking-wider font-medium">Em breve</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{stat.value}</p>
                        <p className="text-sm text-white/50 mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* User info card */}
            {user && (
                <div className="card">
                    <h2 className="text-lg font-semibold text-white mb-4">Detalhes da Conta</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { label: 'E-mail', value: user.email },
                            { label: 'Função', value: user.role },
                            { label: 'Empresa', value: user.tenant.name },
                            { label: 'Plano', value: user.tenant.plan },
                            { label: 'ID Usuário', value: user.id },
                            { label: 'ID Empresa', value: user.tenant.id },
                        ].map((item) => (
                            <div key={item.label}>
                                <p className="text-xs text-white/30 uppercase tracking-wider mb-1">{item.label}</p>
                                <p className="text-sm text-white/80 font-mono truncate">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
