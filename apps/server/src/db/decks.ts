/**
 * Deck database operations.
 */

import { pool, type DeckMetadata, type DeckRow } from './schema.js';
import { createHash } from 'crypto';
import type { Deck } from '@deckhand/schema';

/**
 * Compute SHA-256 hash of content
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * List all decks (metadata only)
 */
export async function listDecks(): Promise<DeckMetadata[]> {
  const { rows } = await pool.query(
    `SELECT id, title, description, slide_count, cover_url, created_at, updated_at
     FROM decks
     ORDER BY updated_at DESC`
  );

  return rows.map((row: DeckRow) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    slideCount: row.slide_count,
    coverUrl: row.cover_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get a single deck by ID
 */
export async function getDeck(id: string): Promise<DeckRow | null> {
  const { rows } = await pool.query('SELECT * FROM decks WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/**
 * Create a new deck
 */
export async function createDeck(deck: Deck): Promise<DeckRow> {
  const content = JSON.stringify(deck);
  const contentHash = hashContent(content);
  const slideCount = Object.keys(deck.slides).length;

  await pool.query(
    `INSERT INTO decks (id, title, description, content, content_hash, slide_count)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      deck.meta.id,
      deck.meta.title,
      deck.meta.description || null,
      content,
      contentHash,
      slideCount,
    ]
  );

  return (await getDeck(deck.meta.id))!;
}

/**
 * Update a deck's content
 */
export async function updateDeckContent(id: string, deck: Deck): Promise<DeckRow | null> {
  const content = JSON.stringify(deck);
  const contentHash = hashContent(content);
  const slideCount = Object.keys(deck.slides).length;

  const result = await pool.query(
    `UPDATE decks
     SET title = $1, description = $2, content = $3, content_hash = $4,
         slide_count = $5, updated_at = NOW()
     WHERE id = $6`,
    [
      deck.meta.title,
      deck.meta.description || null,
      content,
      contentHash,
      slideCount,
      id,
    ]
  );

  if (result.rowCount === 0) return null;
  return getDeck(id);
}

/**
 * Update deck metadata only (doesn't update content_hash to trigger re-bootstrap)
 */
export async function updateDeckMetadata(
  id: string,
  updates: { title?: string; description?: string }
): Promise<DeckRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.title !== undefined) {
    fields.push(`title = $${paramIndex++}`);
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }

  if (fields.length === 0) return getDeck(id);

  fields.push('updated_at = NOW()');
  values.push(id);

  const result = await pool.query(
    `UPDATE decks SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  );

  if (result.rowCount === 0) return null;
  return getDeck(id);
}

/**
 * Delete a deck
 */
export async function deleteDeck(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM decks WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Duplicate a deck with a new ID
 */
export async function duplicateDeck(id: string, newId: string): Promise<DeckRow | null> {
  const original = await getDeck(id);
  if (!original) return null;

  const deck = JSON.parse(original.content) as Deck;
  const now = new Date().toISOString();

  deck.meta.id = newId;
  deck.meta.title = `${deck.meta.title} (copy)`;
  deck.meta.created = now;
  deck.meta.updated = now;

  return createDeck(deck);
}

/**
 * Get YDoc state for a deck
 */
export async function getYDocState(deckId: string): Promise<Buffer | null> {
  const { rows } = await pool.query(
    'SELECT data FROM ydoc_states WHERE deck_id = $1',
    [deckId]
  );
  return rows[0]?.data ?? null;
}

/**
 * Save YDoc state for a deck
 */
export async function saveYDocState(deckId: string, data: Buffer): Promise<void> {
  await pool.query(
    `INSERT INTO ydoc_states (deck_id, data, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (deck_id) DO UPDATE SET
       data = EXCLUDED.data,
       updated_at = NOW()`,
    [deckId, data]
  );
}

/**
 * Delete YDoc state for a deck
 */
export async function deleteYDocState(deckId: string): Promise<void> {
  await pool.query('DELETE FROM ydoc_states WHERE deck_id = $1', [deckId]);
}

/**
 * Get deck with YDoc state for bootstrap
 */
export async function getDeckWithYDocState(id: string): Promise<{
  deck: DeckRow;
  ydocState: Buffer | null;
} | null> {
  const deck = await getDeck(id);
  if (!deck) return null;

  const ydocState = await getYDocState(id);
  return { deck, ydocState };
}
