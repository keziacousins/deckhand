import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Configuration, OAuth2Api, FrontendApi } from '@ory/client';
import { oryConfig, allowedOrigins } from '../config.js';

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
import { upsertUser, updateUserName } from '../db/users.js';
import { getUser } from '../db/users.js';
import { jwtMiddleware, getAuthUser } from '../middleware/auth.js';

const hydraAdmin = new OAuth2Api(
  new Configuration({
    basePath: oryConfig.hydraAdminUrl,
  })
);

const kratosFrontend = new FrontendApi(
  new Configuration({
    basePath: oryConfig.kratosPublicUrl,
  })
);

/**
 * Short-lived map of recently authenticated identities, keyed by random nonce.
 * Used to bridge Kratos native login → Hydra OAuth2 login acceptance.
 */
const recentLogins = new Map<
  string,
  { identityId: string; email: string; name: string; expiresAt: number }
>();

function cleanupRecentLogins() {
  const now = Date.now();
  for (const [key, val] of recentLogins) {
    if (val.expiresAt < now) recentLogins.delete(key);
  }
}

/**
 * Parse Kratos error responses into field-level and general errors.
 */
function parseKratosErrors(data: any): {
  errors: Record<string, string>;
  error?: string;
} {
  const errors: Record<string, string> = {};
  if (data?.ui?.nodes) {
    for (const node of data.ui.nodes) {
      if (node.messages?.length) {
        const name = node.attributes?.name;
        if (name) {
          errors[name] = node.messages.map((m: any) => m.text).join('. ');
        }
      }
    }
  }
  const generalErrors = data?.ui?.messages
    ?.filter((m: any) => m.type === 'error')
    .map((m: any) => m.text)
    .join('. ');
  return { errors, error: generalErrors || undefined };
}

export const authRouter = Router();

// ─── Kratos Flow Proxies ───────────────────────────────────────────────

/**
 * POST /register — Proxy registration through Kratos native flow.
 * Body: { email, password, name? }
 */
authRouter.post('/register', authRateLimiter, async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data: flow } = await kratosFrontend.createNativeRegistrationFlow();

    const { data: result } = await kratosFrontend.updateRegistrationFlow({
      flow: flow.id,
      updateRegistrationFlowBody: {
        method: 'password',
        password,
        traits: { email, name: name || '' },
      },
    });

    console.log(
      `[Auth] User registered via proxy: ${email} (${result.identity.id})`
    );
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Auth] Registration proxy error:', err?.response?.data || err);
    const data = err?.response?.data;
    if (data?.ui) {
      const parsed = parseKratosErrors(data);
      return res.status(400).json(parsed);
    }
    return res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /login — Proxy login through Kratos native flow.
 * On success, stores a nonce in recentLogins for the Hydra bridge.
 * Body: { email, password }
 * Returns: { success: true, loginNonce: string }
 */
authRouter.post('/login', authRateLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data: flow } = await kratosFrontend.createNativeLoginFlow();

    const { data: result } = await kratosFrontend.updateLoginFlow({
      flow: flow.id,
      updateLoginFlowBody: {
        method: 'password',
        identifier: email,
        password,
      },
    });

    // Store successful login for the Hydra bridge
    const nonce = crypto.randomBytes(32).toString('hex');
    const identity = result.session?.identity;
    if (!identity) {
      return res.status(500).json({ error: 'Login succeeded but no identity returned' });
    }
    recentLogins.set(nonce, {
      identityId: identity.id,
      email: (identity.traits as any).email,
      name: (identity.traits as any).name || '',
      expiresAt: Date.now() + 60_000,
    });

    cleanupRecentLogins();

    console.log(`[Auth] User logged in via proxy: ${email}`);
    return res.json({ success: true, loginNonce: nonce });
  } catch (err: any) {
    console.error('[Auth] Login proxy error:', err?.response?.data || err);
    const data = err?.response?.data;
    if (data?.ui) {
      const parsed = parseKratosErrors(data);
      return res.status(401).json(parsed);
    }
    return res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /recovery — Proxy password recovery through Kratos native flow.
 * Always returns success to prevent email enumeration.
 * Body: { email }
 */
authRouter.post('/recovery', authRateLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const { data: flow } = await kratosFrontend.createNativeRecoveryFlow();

    await kratosFrontend.updateRecoveryFlow({
      flow: flow.id,
      updateRecoveryFlowBody: {
        method: 'code',
        email,
      },
    });
  } catch {
    // Swallow errors to prevent email enumeration
  }

  return res.json({ success: true });
});

// ─── Hydra URL Proxies ────────────────────────────────────────────────

/**
 * GET /authorize — Redirect to Hydra's authorize endpoint.
 * The frontend doesn't need to know Hydra's URL.
 * Query params are forwarded as-is to Hydra.
 */
authRouter.get('/authorize', (req, res) => {
  const params = new URLSearchParams(req.query as Record<string, string>);
  return res.redirect(`${oryConfig.hydraPublicUrl}/oauth2/auth?${params.toString()}`);
});

/**
 * GET /logout — Redirect to Hydra's logout endpoint.
 */
authRouter.get('/end-session', (_req, res) => {
  return res.redirect(`${oryConfig.hydraPublicUrl}/oauth2/sessions/logout`);
});

// ─── Hydra Token Proxies ──────────────────────────────────────────────

/**
 * POST /token — Proxy OAuth2 token exchange through Hydra.
 * The browser can't call Hydra directly due to CORS.
 * Body: { code, code_verifier, redirect_uri }
 */
authRouter.post('/token', async (req, res) => {
  const { code, code_verifier, redirect_uri } = req.body;

  if (!code || !code_verifier || !redirect_uri) {
    return res.status(400).json({ error: 'Missing code, code_verifier, or redirect_uri' });
  }

  if (!allowedOrigins.some((origin: string) => redirect_uri.startsWith(origin + '/'))) {
    return res.status(400).json({ error: 'Invalid redirect_uri' });
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      client_id: 'deckhand-editor',
      code_verifier,
    });

    const response = await fetch(`${oryConfig.hydraPublicUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Auth] Token exchange error:', data);
      return res.status(response.status).json(data);
    }

    return res.json(data);
  } catch (error) {
    console.error('[Auth] Token exchange error:', error);
    return res.status(500).json({ error: 'Token exchange failed' });
  }
});

/**
 * POST /refresh — Proxy OAuth2 token refresh through Hydra.
 * Body: { refresh_token }
 */
authRouter.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh_token' });
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
      client_id: 'deckhand-editor',
    });

    const response = await fetch(`${oryConfig.hydraPublicUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[Auth] Token refresh error:', data);
      return res.status(response.status).json(data);
    }

    // Debug: log the issuer in the new access token
    if (data.access_token) {
      try {
        const payload = JSON.parse(Buffer.from(data.access_token.split('.')[1], 'base64').toString());
        console.log('[Auth] Refreshed token issuer:', payload.iss);
      } catch {}
    }

    return res.json(data);
  } catch (error) {
    console.error('[Auth] Token refresh error:', error);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ─── Hydra OAuth2 Handlers ─────────────────────────────────────────────

/**
 * GET /login — Hydra redirects here with ?login_challenge=...
 *
 * Checks for a login_hint nonce from our POST /login proxy.
 * If found, accepts immediately. Otherwise falls back to Kratos redirect.
 */
authRouter.get('/login', async (req, res) => {
  try {
    const challenge = req.query.login_challenge as string;
    if (!challenge) {
      return res.status(400).json({ error: 'Missing login_challenge' });
    }

    const { data: loginRequest } = await hydraAdmin.getOAuth2LoginRequest({
      loginChallenge: challenge,
    });

    if (loginRequest.skip) {
      const { data: completion } = await hydraAdmin.acceptOAuth2LoginRequest({
        loginChallenge: challenge,
        acceptOAuth2LoginRequest: {
          subject: loginRequest.subject,
        },
      });
      return res.redirect(completion.redirect_to);
    }

    // Check for a recent login via our proxy (nonce passed as login_hint)
    const loginHint = loginRequest.oidc_context?.login_hint;
    if (loginHint) {
      const recentLogin = recentLogins.get(loginHint);
      if (recentLogin && recentLogin.expiresAt > Date.now()) {
        recentLogins.delete(loginHint);
        const { data: completion } = await hydraAdmin.acceptOAuth2LoginRequest({
          loginChallenge: challenge,
          acceptOAuth2LoginRequest: {
            subject: recentLogin.identityId,
          },
        });
        return res.redirect(completion.redirect_to);
      }
    }

    // Fallback: redirect to Kratos login UI
    const kratosLoginUrl = new URL(
      '/self-service/login/browser',
      oryConfig.kratosPublicUrl
    );
    kratosLoginUrl.searchParams.set(
      'return_to',
      `${oryConfig.hydraPublicUrl}/oauth2/auth?login_challenge=${challenge}`
    );
    return res.redirect(kratosLoginUrl.toString());
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /consent — Hydra redirects here with ?consent_challenge=...
 *
 * Auto-accepts for first-party app. Injects custom claims into the JWT
 * via session.access_token.
 */
authRouter.get('/consent', async (req, res) => {
  try {
    const challenge = req.query.consent_challenge as string;
    if (!challenge) {
      return res.status(400).json({ error: 'Missing consent_challenge' });
    }

    const { data: consentRequest } = await hydraAdmin.getOAuth2ConsentRequest({
      consentChallenge: challenge,
    });

    // Ensure local user record exists (fetch identity from Kratos if needed)
    let user = consentRequest.subject
      ? await getUser(consentRequest.subject)
      : null;

    if (!user && consentRequest.subject) {
      try {
        const identityRes = await fetch(
          `${oryConfig.kratosAdminUrl}/admin/identities/${consentRequest.subject}`
        );
        if (identityRes.ok) {
          const identity = await identityRes.json();
          const email = identity.traits?.email;
          const name = identity.traits?.name ?? null;
          if (email) {
            user = await upsertUser(consentRequest.subject, email, name);
            console.log(`[Auth] Auto-created user from consent: ${email}`);
          }
        }
      } catch (err) {
        console.error('[Auth] Failed to fetch identity from Kratos:', err);
      }
    }

    const { data: completion } = await hydraAdmin.acceptOAuth2ConsentRequest({
      consentChallenge: challenge,
      acceptOAuth2ConsentRequest: {
        grant_scope: consentRequest.requested_scope,
        grant_access_token_audience:
          consentRequest.requested_access_token_audience,
        session: {
          access_token: {
            user_id: consentRequest.subject,
            email: user?.email ?? null,
            name: user?.name ?? null,
          },
        },
      },
    });

    return res.redirect(completion.redirect_to);
  } catch (error) {
    console.error('[Auth] Consent error:', error);
    return res.status(500).json({ error: 'Consent failed' });
  }
});

/**
 * GET /logout — Hydra redirects here with ?logout_challenge=...
 */
authRouter.get('/logout', async (req, res) => {
  try {
    const challenge = req.query.logout_challenge as string;
    if (!challenge) {
      return res.status(400).json({ error: 'Missing logout_challenge' });
    }

    const { data: completion } = await hydraAdmin.acceptOAuth2LogoutRequest({
      logoutChallenge: challenge,
    });

    return res.redirect(completion.redirect_to);
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// ─── Settings (require JWT) ──────────────────────────────────────────

/**
 * POST /settings/profile — Update display name.
 * Updates both local DB and Kratos identity traits.
 * Body: { name }
 */
authRouter.post('/settings/profile', jwtMiddleware, async (req, res) => {
  const claims = getAuthUser(req);
  if (!claims) return res.status(401).json({ error: 'Unauthorized' });

  const { name } = req.body;
  if (typeof name !== 'string') {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    // Update local DB
    await updateUserName(claims.sub, name.trim());

    // Update Kratos identity traits
    const identityRes = await fetch(
      `${oryConfig.kratosAdminUrl}/admin/identities/${claims.sub}`
    );
    if (identityRes.ok) {
      const identity = await identityRes.json();
      await fetch(`${oryConfig.kratosAdminUrl}/admin/identities/${claims.sub}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema_id: identity.schema_id,
          traits: { ...identity.traits, name: name.trim() },
          state: identity.state,
        }),
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Profile update error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * POST /settings/password — Change password via Kratos admin API.
 * Body: { password }
 */
authRouter.post('/settings/password', jwtMiddleware, async (req, res) => {
  const claims = getAuthUser(req);
  if (!claims) return res.status(401).json({ error: 'Unauthorized' });

  const { password } = req.body;
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Use Kratos admin API to update password
    const identityRes = await fetch(
      `${oryConfig.kratosAdminUrl}/admin/identities/${claims.sub}`
    );
    if (!identityRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch identity' });
    }
    const identity = await identityRes.json();

    await fetch(`${oryConfig.kratosAdminUrl}/admin/identities/${claims.sub}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schema_id: identity.schema_id,
        traits: identity.traits,
        state: identity.state,
        credentials: {
          password: {
            config: { password },
          },
        },
      }),
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Password change error:', error);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * POST /hooks/registration — Kratos webhook after user registration.
 * Body shape from webhook.registration.jsonnet: { identity_id, email, name }
 */
authRouter.post('/hooks/registration', async (req, res) => {
  try {
    const { identity_id, email, name } = req.body;

    if (!identity_id || !email) {
      return res.status(400).json({ error: 'Missing identity_id or email' });
    }

    await upsertUser(identity_id, email, name ?? null);

    console.log(`[Auth] User registered: ${email} (${identity_id})`);
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[Auth] Registration webhook error:', error);
    return res.status(500).json({ error: 'Registration hook failed' });
  }
});
