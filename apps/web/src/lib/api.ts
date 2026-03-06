const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    if (!accessToken) {
        accessToken = sessionStorage.getItem('access_token');
    }
    return accessToken;
}

export function setAccessToken(token: string): void {
    accessToken = token;
    if (typeof window !== 'undefined') {
        sessionStorage.setItem('access_token', token);
    }
}

export function clearAccessToken(): void {
    accessToken = null;
    if (typeof window !== 'undefined') {
        sessionStorage.removeItem('access_token');
    }
}

export async function apiFetch<T = unknown>(
    path: string,
    options?: RequestInit,
): Promise<T> {
    const token = getAccessToken();

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options?.headers ?? {}),
        },
    });

    // Try refresh on 401
    if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
        });

        if (refreshRes.ok) {
            const data = await refreshRes.json();
            setAccessToken(data.accessToken);

            // Retry original request with new token
            const retryRes = await fetch(`${API_BASE}${path}`, {
                ...options,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${data.accessToken}`,
                    ...(options?.headers ?? {}),
                },
            });

            if (!retryRes.ok) {
                const err = await retryRes.json().catch(() => ({ error: 'Request failed' }));
                throw new ApiError(retryRes.status, err.error || 'Request failed');
            }
            return retryRes.json();
        }

        // Refresh failed — force login
        clearAccessToken();
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
        throw new ApiError(401, 'Session expired');
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new ApiError(res.status, err.error || 'Request failed');
    }

    return res.json();
}

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}
