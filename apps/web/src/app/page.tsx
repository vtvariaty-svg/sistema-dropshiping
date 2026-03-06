'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/api';

export default function HomePage() {
    const router = useRouter();

    useEffect(() => {
        const token = getAccessToken();
        if (token) {
            router.replace('/dashboard');
        } else {
            router.replace('/login');
        }
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="animate-pulse text-white/40 text-lg">Carregando...</div>
        </div>
    );
}
