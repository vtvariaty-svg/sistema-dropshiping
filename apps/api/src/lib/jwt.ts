import jwt from 'jsonwebtoken';
import type { AccessTokenPayload } from '@dropship/shared';

const ACCESS_TOKEN_EXPIRY = '15m';

let _accessSecret: string;

function getAccessSecret(): string {
    if (!_accessSecret) {
        _accessSecret = process.env.JWT_ACCESS_SECRET || '';
    }
    return _accessSecret;
}

export function signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, getAccessSecret(), {
        expiresIn: ACCESS_TOKEN_EXPIRY,
    });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, getAccessSecret());
    return decoded as AccessTokenPayload;
}
