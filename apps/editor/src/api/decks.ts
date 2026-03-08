/**
 * Deck API client
 */

const API_BASE = '/api';

// Module-level token for auth headers
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

function authHeaders(): Record<string, string> {
  if (_authToken) {
    return { Authorization: `Bearer ${_authToken}` };
  }
  return {};
}

export interface DeckMetadata {
  id: string;
  title: string;
  description: string | null;
  slideCount: number;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeckFull extends DeckMetadata {
  content: import('@deckhand/schema').Deck;
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
  const response = await fetch(`${API_BASE}/decks`, {
    headers: authHeaders(),
  });
  return handleResponse(response);
}

/**
 * Get a single deck with content
 */
export async function getDeck(id: string): Promise<DeckFull> {
  const response = await fetch(`${API_BASE}/decks/${id}`, {
    headers: authHeaders(),
  });
  return handleResponse(response);
}

/**
 * Create a new deck
 */
export async function createDeck(data: {
  title?: string;
  description?: string;
}): Promise<DeckMetadata> {
  const response = await fetch(`${API_BASE}/decks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Update deck metadata
 */
export async function updateDeckMetadata(
  id: string,
  data: { title?: string; description?: string }
): Promise<DeckMetadata> {
  const response = await fetch(`${API_BASE}/decks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

/**
 * Delete a deck
 */
export async function deleteDeck(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/decks/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
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
  const response = await fetch(`${API_BASE}/decks/${id}/duplicate`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse(response);
}
