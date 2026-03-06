'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import type { UserInfo } from '../../layout';

interface User {
    id: string;
    email: string;
    role: string;
    created_at: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ email: '', password: '', role: 'operator' });
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [me, data] = await Promise.all([
                apiFetch<UserInfo>('/me'),
                apiFetch<User[]>('/users')
            ]);
            setCurrentUser(me);
            setUsers(data);
        } catch (e) {
            setMessage('Falha ao carregar usuários');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setSubmitting(true);
        try {
            await apiFetch('/users', {
                method: 'POST',
                body: JSON.stringify(form)
            });
            setForm({ email: '', password: '', role: 'operator' });
            await loadData();
            setMessage('Usuário criado com sucesso!');
        } catch (e: any) {
            setMessage(`Falha: ${e.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, email: string) => {
        if (!confirm(`Excluir o usuário ${email}?`)) return;
        
        try {
            await apiFetch(`/users/${id}`, { method: 'DELETE' });
            await loadData();
        } catch (e: any) {
            setMessage(`Falha ao excluir: ${e.message}`);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Usuários</h1>
                <p className="text-white/40 mt-1">Gerencie os usuários e permissões da sua empresa</p>
            </div>

            {/* Create form */}
            <div className="card">
                <h2 className="text-lg font-semibold text-white mb-4">Adicionar Novo Usuário</h2>
                <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                        type="email"
                        required
                        placeholder="E-mail"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="input-field"
                    />
                    <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="Senha (mín. 6 caracteres)"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="input-field"
                    />
                    <select
                        value={form.role}
                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                        className="input-field"
                    >
                        <option value="operator">Operador (Leitura/Gestão)</option>
                        <option value="admin">Administrador (Total)</option>
                    </select>
                    <button type="submit" disabled={submitting} className="btn-primary text-sm whitespace-nowrap">
                        {submitting ? 'Criando...' : 'Criar Usuário'}
                    </button>
                </form>
                {message && (
                    <p className={`text-sm mt-3 ${message.includes('sucesso') ? 'text-emerald-400' : 'text-red-400'}`}>
                        {message}
                    </p>
                )}
            </div>

            {/* Users list */}
            <div className="card">
                {loading ? (
                    <p className="text-white/30 text-sm">Carregando...</p>
                ) : users.length === 0 ? (
                    <p className="text-white/30 text-sm">Nenhum usuário encontrado.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-3 px-2 text-white/40">E-mail</th>
                                    <th className="text-left py-3 px-2 text-white/40">Função</th>
                                    <th className="text-left py-3 px-2 text-white/40">Criado Em</th>
                                    <th className="text-right py-3 px-2 text-white/40">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                        <td className="py-3 px-2 text-white">{u.email}</td>
                                        <td className="py-3 px-2">
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="py-3 px-2 text-white/50 text-xs">
                                            {new Date(u.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-2 text-right">
                                            <button
                                                onClick={() => handleDelete(u.id, u.email)}
                                                disabled={u.id === currentUser?.id}
                                                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-30 transition-colors"
                                                title={u.id === currentUser?.id ? "Você não pode excluir a si mesmo" : "Excluir usuário"}
                                            >
                                                Excluir
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
