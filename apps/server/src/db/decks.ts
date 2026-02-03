/**
 * Deck database operations.
 */

import { db, type DeckMetadata, type DeckRow, type YDocStateRow } from './schema.js';
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
export function listDecks(): DeckMetadata[] {
  const stmt = db.prepare(`
    SELECT id, title, description, slide_count, cover_url, created_at, updated_at
    FROM decks
    ORDER BY updated_at DESC
  `);

  const rows = stmt.all() as Array<{
    id: string;
    title: string;
    description: string | null;
    slide_count: number;
    cover_url: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
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
export function getDeck(id: string): DeckRow | null {
  const stmt = db.prepare('SELECT * FROM decks WHERE id = ?');
  return (stmt.get(id) as DeckRow) || null;
}

/**
 * Create a new deck
 */
export function createDeck(deck: Deck): DeckRow {
  const content = JSON.stringify(deck);
  const contentHash = hashContent(content);
  const slideCount = Object.keys(deck.slides).length;

  const stmt = db.prepare(`
    INSERT INTO decks (id, title, description, content, content_hash, slide_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    deck.meta.id,
    deck.meta.title,
    deck.meta.description || null,
    content,
    contentHash,
    slideCount
  );

  return getDeck(deck.meta.id)!;
}

/**
 * Update a deck's content
 */
export function updateDeckContent(id: string, deck: Deck): DeckRow | null {
  const content = JSON.stringify(deck);
  const contentHash = hashContent(content);
  const slideCount = Object.keys(deck.slides).length;

  const stmt = db.prepare(`
    UPDATE decks
    SET title = ?, description = ?, content = ?, content_hash = ?,
        slide_count = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(
    deck.meta.title,
    deck.meta.description || null,
    content,
    contentHash,
    slideCount,
    id
  );

  if (result.changes === 0) return null;
  return getDeck(id);
}

/**
 * Update deck metadata only (doesn't update content_hash to trigger re-bootstrap)
 */
export function updateDeckMetadata(
  id: string,
  updates: { title?: string; description?: string }
): DeckRow | null {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }

  if (fields.length === 0) return getDeck(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(`
    UPDATE decks SET ${fields.join(', ')} WHERE id = ?
  `);

  const result = stmt.run(...values);
  if (result.changes === 0) return null;
  return getDeck(id);
}

/**
 * Delete a deck
 */
export function deleteDeck(id: string): boolean {
  const stmt = db.prepare('DELETE FROM decks WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Duplicate a deck with a new ID
 */
export function duplicateDeck(id: string, newId: string): DeckRow | null {
  const original = getDeck(id);
  if (!original) return null;

  const deck = JSON.parse(original.content) as Deck;
  const now = new Date().toISOString();

  // Update IDs and title
  deck.meta.id = newId;
  deck.meta.title = `${deck.meta.title} (copy)`;
  deck.meta.created = now;
  deck.meta.updated = now;

  return createDeck(deck);
}

/**
 * Get YDoc state for a deck
 */
export function getYDocState(deckId: string): Buffer | null {
  const stmt = db.prepare('SELECT data FROM ydoc_states WHERE deck_id = ?');
  const row = stmt.get(deckId) as YDocStateRow | undefined;
  return row?.data || null;
}

/**
 * Save YDoc state for a deck
 */
export function saveYDocState(deckId: string, data: Buffer): void {
  const stmt = db.prepare(`
    INSERT INTO ydoc_states (deck_id, data, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(deck_id) DO UPDATE SET
      data = excluded.data,
      updated_at = datetime('now')
  `);
  stmt.run(deckId, data);
}

/**
 * Delete YDoc state for a deck
 */
export function deleteYDocState(deckId: string): void {
  const stmt = db.prepare('DELETE FROM ydoc_states WHERE deck_id = ?');
  stmt.run(deckId);
}

/**
 * Get deck with YDoc state for bootstrap
 */
export function getDeckWithYDocState(id: string): {
  deck: DeckRow;
  ydocState: Buffer | null;
} | null {
  const deck = getDeck(id);
  if (!deck) return null;

  const ydocState = getYDocState(id);
  return { deck, ydocState };
}
