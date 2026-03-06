export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    user: {
        id: string;
        email: string;
        role: string;
        tenant: {
            id: string;
            name: string;
            plan: string;
        };
    };
}

export interface RefreshResponse {
    accessToken: string;
}

export interface MeResponse {
    id: string;
    email: string;
    role: string;
    createdAt: string;
    tenant: {
        id: string;
        name: string;
        plan: string;
    };
}

export interface AccessTokenPayload {
    userId: string;
    tenantId: string;
    role: string;
}
