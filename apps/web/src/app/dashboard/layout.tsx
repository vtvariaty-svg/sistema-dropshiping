'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, clearAccessToken, apiFetch } from '@/lib/api';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';

export interface UserInfo {
    id: string;
    email: string;
    role: string;
    createdAt: string;
    tenant: { id: string; name: string; plan: string };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const token = getAccessToken();
        if (!token) {
            router.replace('/login');
            return;
        }

        apiFetch<UserInfo>('/me')
            .then(setUser)
            .catch(() => {
                clearAccessToken();
                router.replace('/login');
            })
            .finally(() => setLoading(false));
    }, [router]);

    const handleLogout = async () => {
        try {
            await apiFetch('/auth/logout', { method: 'POST' });
        } catch {
            // Proceed even if API call fails
        }
        clearAccessToken();
        router.replace('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-pulse text-white/40 text-lg">Carregando...</div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen flex">
            <Sidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                <Header
                    user={user}
                    onMenuClick={() => setSidebarOpen(true)}
                    onLogout={handleLogout}
                />
                <main className="flex-1 p-6 lg:p-8 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
