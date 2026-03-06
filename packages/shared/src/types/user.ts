export type UserRole = 'admin' | 'operator';

export interface User {
    id: string;
    tenantId: string;
    email: string;
    role: UserRole;
    createdAt: string;
}
