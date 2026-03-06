'use client';

import type { UserInfo } from '@/app/dashboard/layout';

interface SidebarProps {
    user: UserInfo;
    open: boolean;
    onClose: () => void;
}

const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Orders', href: '#', icon: '📦', soon: true },
    { label: 'Products', href: '#', icon: '🏷️', soon: true },
    { label: 'Suppliers', href: '#', icon: '🏭', soon: true },
    { label: 'Intelligence', href: '#', icon: '🧠', soon: true },
];

export function Sidebar({ user, open, onClose }: SidebarProps) {
    return (
        <>
            {/* Mobile overlay */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 flex flex-col
          bg-surface-800/80 backdrop-blur-xl border-r border-white/5
          transform transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
            >
                {/* Logo */}
                <div className="h-16 flex items-center px-6 border-b border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center mr-3">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <span className="text-lg font-bold text-white">
                        Drop<span className="text-brand-400">SaaS</span>
                    </span>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <a
                            key={item.label}
                            href={item.href}
                            className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150
                ${item.href === '/dashboard'
                                    ? 'bg-brand-600/20 text-brand-300'
                                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                                }
              `}
                        >
                            <span className="text-lg">{item.icon}</span>
                            <span>{item.label}</span>
                            {item.soon && (
                                <span className="ml-auto text-[10px] uppercase tracking-wider text-white/20 bg-white/5 px-2 py-0.5 rounded-full">
                                    Soon
                                </span>
                            )}
                        </a>
                    ))}
                </nav>

                {/* User info at bottom */}
                <div className="p-4 border-t border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm font-bold text-white">
                            {user.email[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user.email}</p>
                            <p className="text-xs text-white/30 capitalize">{user.role}</p>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
