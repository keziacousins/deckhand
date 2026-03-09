import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { setAuthToken } from '../api/decks';

// Auth config from env vars (with defaults for local dev)
const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL || 'http://localhost:5178';
const CLIENT_ID = import.meta.env.VITE_OAUTH2_CLIENT_ID || 'deckhand-editor';

interface AuthUser {
  sub: string;
  email: string | null;
  name: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (loginHint?: string) => void;
  logout: () => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  refreshSession: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Decode JWT payload without verification (browser-side, token already validated by server).
 */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(payload));
}

/**
 * Extract user info from JWT claims.
 * Hydra puts custom claims in `ext` (from consent session.access_token).
 */
function extractUser(token: string): AuthUser | null {
  try {
    const payload = decodeJwtPayload(token);
    const ext = payload.ext as Record<string, unknown> | undefined;
    return {
      sub: (payload.sub as string) || '',
      email: (ext?.email as string) ?? null,
      name: (ext?.name as string) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Get token expiry time in ms from now. Returns 0 if expired or invalid.
 */
function getTokenExpiresIn(token: string): number {
  try {
    const payload = decodeJwtPayload(token);
    const exp = payload.exp as number;
    if (!exp) return 0;
    return exp * 1000 - Date.now();
  } catch {
    return 0;
  }
}

// --- PKCE helpers ---

function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// --- Token exchange (proxied through Express backend) ---

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<{ access_token: string; refresh_token?: string }> {
  const response = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      redirect_uri: `${PUBLIC_URL}/callback`,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  return response.json();
}

async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token?: string }> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  return response.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule auto-refresh before token expires
  const scheduleRefresh = useCallback((accessToken: string, refreshToken: string) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    const expiresIn = getTokenExpiresIn(accessToken);
    if (expiresIn <= 0) return;

    // Refresh 60 seconds before expiry
    const refreshIn = Math.max(expiresIn - 60_000, 1000);
    console.log(`[Auth] Token expires in ${Math.round(expiresIn / 1000)}s, scheduling refresh in ${Math.round(refreshIn / 1000)}s`);

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const result = await refreshAccessToken(refreshToken);
        setAuthToken(result.access_token);
        setToken(result.access_token);
        setUser(extractUser(result.access_token));

        // Update stored refresh token if rotated
        if (result.refresh_token) {
          localStorage.setItem('deckhand_refresh_token', result.refresh_token);
        }

        // Schedule next refresh
        scheduleRefresh(
          result.access_token,
          result.refresh_token || refreshToken
        );
      } catch {
        // Refresh failed — clear auth state, user needs to re-login
        setToken(null);
        setUser(null);
        localStorage.removeItem('deckhand_refresh_token');
      }
    }, refreshIn);
  }, []);

  // Handle incoming tokens (from callback or refresh)
  const handleTokens = useCallback(
    (accessToken: string, refreshToken?: string) => {
      // Sync token to API module immediately (before React re-renders)
      setAuthToken(accessToken);
      setToken(accessToken);
      setUser(extractUser(accessToken));

      if (refreshToken) {
        localStorage.setItem('deckhand_refresh_token', refreshToken);
        scheduleRefresh(accessToken, refreshToken);
      }
    },
    [scheduleRefresh]
  );

  // On mount: try to restore session from refresh token
  useEffect(() => {
    const storedRefresh = localStorage.getItem('deckhand_refresh_token');
    if (!storedRefresh) {
      setIsLoading(false);
      return;
    }

    refreshAccessToken(storedRefresh)
      .then((result) => {
        handleTokens(result.access_token, result.refresh_token || storedRefresh);
      })
      .catch(() => {
        localStorage.removeItem('deckhand_refresh_token');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [handleTokens]);

  // Handle OAuth2 callback (path-based: /callback?code=...&state=...)
  useEffect(() => {
    if (window.location.pathname !== '/callback') return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const codeVerifier = sessionStorage.getItem('deckhand_pkce_verifier');
    const savedState = sessionStorage.getItem('deckhand_oauth_state');

    if (!code || !codeVerifier) return;

    if (returnedState !== savedState) {
      console.error('[Auth] OAuth state mismatch');
      window.location.replace('/');
      return;
    }

    sessionStorage.removeItem('deckhand_pkce_verifier');
    sessionStorage.removeItem('deckhand_oauth_state');

    exchangeCodeForTokens(code, codeVerifier)
      .then((result) => {
        handleTokens(result.access_token, result.refresh_token);
        // Navigate to deck list — replace so /callback isn't in history
        window.location.replace('/#/');
      })
      .catch((err) => {
        console.error('[Auth] Token exchange failed:', err);
        window.location.replace('/#/');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [handleTokens]);

  const login = useCallback(async (loginHint?: string) => {
    const codeVerifier = generateRandomString(64);
    const state = generateRandomString(16);
    sessionStorage.setItem('deckhand_pkce_verifier', codeVerifier);
    sessionStorage.setItem('deckhand_oauth_state', state);

    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      scope: 'openid offline_access',
      redirect_uri: `${PUBLIC_URL}/callback`,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });
    if (loginHint) {
      params.set('login_hint', loginHint);
    }

    window.location.href = `/api/auth/authorize?${params.toString()}`;
  }, []);

  const refreshSession = useCallback(async () => {
    const storedRefresh = localStorage.getItem('deckhand_refresh_token');
    if (!storedRefresh) return;
    try {
      const result = await refreshAccessToken(storedRefresh);
      handleTokens(result.access_token, result.refresh_token || storedRefresh);
    } catch {
      // Refresh failed — ignore, user state stays as-is
    }
  }, [handleTokens]);

  const logout = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    setAuthToken(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem('deckhand_refresh_token');

    // Redirect to logout via backend proxy
    window.location.href = '/api/auth/end-session';
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}
