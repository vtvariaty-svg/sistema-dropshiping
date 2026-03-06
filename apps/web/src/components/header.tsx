'use client';

import type { UserInfo } from '@/app/dashboard/layout';

interface HeaderProps {
    user: UserInfo;
    onMenuClick: () => void;
    onLogout: () => void;
}

export function Header({ user, onMenuClick, onLogout }: HeaderProps) {
    return (
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-surface-800/40 backdrop-blur-xl">
            {/* Left: mobile menu + breadcrumb */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                    aria-label="Abrir menu"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <div className="text-sm text-white/30">
                    <span className="text-white/60 font-medium">{user.tenant.name}</span>
                    <span className="mx-2">·</span>
                    <span className="capitalize">{user.tenant.plan}</span>
                </div>
            </div>

            {/* Right: logout */}
            <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white/50 
                   hover:text-white hover:bg-white/5 transition-all duration-150"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sair
            </button>
        </header>
    );
}
