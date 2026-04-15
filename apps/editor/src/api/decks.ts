/**
 * Deck API client
 */

const API_BASE = '/api';

// Module-level token for auth headers
let _authToken: string | null = null;

// Callback for requesting a token refresh (set by AuthProvider)
let _onTokenExpired: (() => Promise<void>) | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

export function getAuthToken(): string | null {
  return _authToken;
}

/** Register a callback that AuthProvider calls to refresh the token on 401 */
export function setTokenExpiredHandler(handler: (() => Promise<void>) | null) {
  _onTokenExpired = handler;
}

/** Attempt to refresh the auth token. Returns true if successful. */
export async function tryRefreshToken(): Promise<boolean> {
  if (!_onTokenExpired) return false;
  try {
    await _onTokenExpired();
    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticated fetch wrapper. Automatically attaches Authorization header.
 * On 401, attempts one token refresh and retries the request.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (_authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${_authToken}`);
  }
  const response = await fetch(input, { ...init, headers });

  // On 401, try refreshing the token and retry once
  if (response.status === 401 && _onTokenExpired) {
    try {
      await _onTokenExpired();
      // Retry with the (now-updated) token
      const retryHeaders = new Headers(init?.headers);
      if (_authToken) {
        retryHeaders.set('Authorization', `Bearer ${_authToken}`);
      }
      return fetch(input, { ...init, headers: retryHeaders });
    } catch {
      // Refresh failed — return original 401
    }
  }

  return response;
}

export type DeckRole = 'owner' | 'editor' | 'viewer';

export interface DeckMetadata {
  id: string;
  title: string;
  description: string | null;
  slideCount: number;
  coverUrl: string | null;
  role: DeckRole;
  createdAt: string;
  updatedAt: string;
}

export interface DeckFull extends DeckMetadata {
  content: import('@deckhand/schema').Deck;
  publicAccess?: string;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || 'Request failed');
  }
  return response.json();
}

/**
 * List all decks
 */
export async function listDecks(): Promise<DeckMetadata[]> {
  const response = await apiFetch(`${API_BASE}/decks`);
  return handleResponse(response);
}

/**
 * Get a single deck with content
 */
export async function getDeck(id: string): Promise<DeckFull> {
  const response = await apiFetch(`${API_BASE}/decks/${id}`);
  return handleResponse(response);
}

/**
 * Create a new deck
 */
export async function createDeck(data: {
  title?: string;
  description?: string;
}): Promise<DeckMetadata> {
  const response = await apiFetch(`${API_BASE}/decks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}


/**
 * Delete a deck
 */
export async function deleteDeck(id: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/decks/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || 'Request failed');
  }
}

/**
 * Duplicate a deck
 */
export async function duplicateDeck(id: string): Promise<DeckMetadata> {
  const response = await apiFetch(`${API_BASE}/decks/${id}/duplicate`, {
    method: 'POST',
  });
  return handleResponse(response);
}

// ============================================================================
// Public Access API
// ============================================================================

export type PublicAccess = 'none' | 'present';

export async function setPublicAccess(
  deckId: string,
  publicAccess: PublicAccess
): Promise<{ publicAccess: PublicAccess }> {
  const response = await apiFetch(`${API_BASE}/decks/${deckId}/public`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicAccess }),
  });
  return handleResponse(response);
}

// ============================================================================
// Share API
// ============================================================================

export interface DeckShare {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  role: 'editor' | 'viewer';
  createdAt: string;
}

export async function listShares(deckId: string): Promise<DeckShare[]> {
  const response = await apiFetch(`${API_BASE}/decks/${deckId}/shares`);
  return handleResponse<DeckShare[]>(response);
}

export async function addShare(
  deckId: string,
  email: string,
  role: 'editor' | 'viewer'
): Promise<DeckShare> {
  const response = await apiFetch(`${API_BASE}/decks/${deckId}/shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  });
  return handleResponse(response);
}

export async function updateShare(
  deckId: string,
  shareId: string,
  role: 'editor' | 'viewer'
): Promise<void> {
  const response = await apiFetch(`${API_BASE}/decks/${deckId}/shares/${shareId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || 'Request failed');
  }
}

export async function removeShare(deckId: string, shareId: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/decks/${deckId}/shares/${shareId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || 'Request failed');
  }
}
