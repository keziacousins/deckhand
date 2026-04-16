import { expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import { oryConfig, publicUrl } from '../config.js';

const hydraIssuer = publicUrl;
import type { Request } from 'express';

/**
 * Custom JWT claims injected by Hydra consent endpoint.
 */
export interface JWTClaims {
  sub: string;
  ext: {
    user_id: string;
    email: string | null;
    name: string | null;
  };
  iss: string;
  aud: string[];
  exp: number;
  iat: number;
}

const JWKS_URI = `${oryConfig.hydraUrl}/.well-known/jwks.json`;
const JWKS_TIMEOUT_MS = 5000;

// Shared JWKS client for both Express middleware and manual verification
const jwksClient = jwksRsa({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: JWKS_URI,
  timeout: JWKS_TIMEOUT_MS,
});

/**
 * JWT validation middleware.
 * Requires a valid token — returns 401 if missing or invalid.
 */
export const jwtMiddleware = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: JWKS_URI,
    timeout: JWKS_TIMEOUT_MS,
  }) as jwksRsa.GetVerificationKey,
  algorithms: ['RS256'],
  issuer: hydraIssuer,
  credentialsRequired: true,
});

/**
 * Type-safe accessor for the authenticated user.
 * Returns null if no token was provided.
 */
export function getAuthUser(req: Request): JWTClaims | null {
  return (req as any).auth ?? null;
}

/**
 * Verify a JWT token string directly (for WebSocket upgrade).
 * Returns decoded claims or null if invalid.
 */
export async function verifyToken(token: string): Promise<JWTClaims | null> {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header.kid) return null;

    const key = await jwksClient.getSigningKey(decoded.header.kid);
    const signingKey = key.getPublicKey();

    const verified = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      issuer: hydraIssuer,
    });

    return verified as JWTClaims;
  } catch {
    return null;
  }
}
