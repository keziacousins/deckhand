/**
 * Deck API client
 */

const API_BASE = '/api';

export interface DeckMetadata {
  id: string;
  title: string;
  description: string | null;
  slideCount: number;
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
  const response = await fetch(`${API_BASE}/decks`);
  return handleResponse(response);
}

/**
 * Get a single deck with content
 */
export async function getDeck(id: string): Promise<DeckFull> {
  const response = await fetch(`${API_BASE}/decks/${id}`);
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
  });
  return handleResponse(response);
}
