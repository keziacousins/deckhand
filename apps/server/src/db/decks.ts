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
 * List decks the user owns or has been shared with.
 */
export async function listDecks(userId: string): Promise<DeckMetadata[]> {
  const { rows } = await pool.query(
    `SELECT d.id, d.title, d.description, d.slide_count, d.cover_url,
            d.created_at, d.updated_at,
            CASE
              WHEN d.owner_id = $1 THEN 'owner'
              ELSE ds.role
            END AS role
     FROM decks d
     LEFT JOIN deck_shares ds ON ds.deck_id = d.id AND ds.user_id = $1
     WHERE d.owner_id = $1 OR ds.user_id = $1
     ORDER BY d.updated_at DESC`,
    [userId]
  );

  return rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    slideCount: row.slide_count,
    coverUrl: row.cover_url,
    role: row.role,
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
export async function createDeck(deck: Deck, ownerId: string): Promise<DeckRow> {
  const content = JSON.stringify(deck);
  const contentHash = hashContent(content);
  const slideCount = Object.keys(deck.slides).length;

  await pool.query(
    `INSERT INTO decks (id, title, description, content, content_hash, slide_count, owner_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      deck.meta.id,
      deck.meta.title,
      deck.meta.description || null,
      content,
      contentHash,
      slideCount,
      ownerId,
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
export async function duplicateDeck(id: string, newId: string, ownerId: string): Promise<DeckRow | null> {
  const original = await getDeck(id);
  if (!original) return null;

  const deck = JSON.parse(original.content) as Deck;
  const now = new Date().toISOString();

  deck.meta.id = newId;
  deck.meta.title = `${deck.meta.title} (copy)`;
  deck.meta.created = now;
  deck.meta.updated = now;

  return createDeck(deck, ownerId);
}

/**
 * Get YDoc state for a deck
 */
async function getYDocState(deckId: string): Promise<Buffer | null> {
  const { rows } = await pool.query(
    'SELECT data FROM ydoc_states WHERE deck_id = $1',
    [deckId]
  );
  return rows[0]?.data ?? null;
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
