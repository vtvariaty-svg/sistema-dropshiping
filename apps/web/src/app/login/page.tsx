'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, setAccessToken, ApiError } from '@/lib/api';

interface LoginResult {
    accessToken: string;
    user: {
        id: string;
        email: string;
        role: string;
        tenant: { id: string; name: string; plan: string };
    };
}

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await apiFetch<LoginResult>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });

            setAccessToken(data.accessToken);
            router.push('/dashboard');
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError('An unexpected error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left panel — branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-900 via-brand-800 to-surface-900" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(99,102,241,0.3)_0%,_transparent_60%)]" />
                <div className="relative z-10 flex flex-col justify-center px-16">
                    <div className="mb-8">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center mb-6">
                            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h1 className="text-4xl font-bold text-white mb-3">
                            Dropship<span className="text-brand-400">SaaS</span>
                        </h1>
                        <p className="text-lg text-white/60 max-w-md">
                            Automate your dropshipping operations. Manage orders, track suppliers, and scale your business with intelligence.
                        </p>
                    </div>

                    <div className="space-y-4 mt-12">
                        {[
                            { icon: '📦', text: 'Automated order processing' },
                            { icon: '🔗', text: 'Multi-store Shopify integration' },
                            { icon: '📊', text: 'Product intelligence & analytics' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 text-white/70">
                                <span className="text-xl">{item.icon}</span>
                                <span>{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel — form */}
            <div className="flex-1 flex items-center justify-center px-6">
                <div className="w-full max-w-md">
                    <div className="lg:hidden mb-10 text-center">
                        <h1 className="text-3xl font-bold text-white">
                            Dropship<span className="text-brand-400">SaaS</span>
                        </h1>
                    </div>

                    <div className="card">
                        <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
                        <p className="text-white/40 mb-8">Sign in to your account to continue</p>

                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-2">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="input-field"
                                    placeholder="you@company.com"
                                    required
                                    autoComplete="email"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-2">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-field"
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary w-full mt-2"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Signing in...
                                    </span>
                                ) : (
                                    'Sign in'
                                )}
                            </button>
                        </form>
                    </div>

                    <p className="text-center text-white/20 text-xs mt-8">
                        Demo: admin@demo.com / admin123
                    </p>
                </div>
            </div>
        </div>
    );
}
