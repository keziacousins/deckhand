/**
 * YDoc persistence with hash-based bootstrap.
 *
 * Pattern:
 * - JSON content in `decks` table is the source of truth
 * - Binary YDoc state in `ydoc_states` is ephemeral collaboration cache
 * - Hash comparison determines whether to use cache or re-bootstrap from JSON
 */

import * as Y from 'yjs';
import {
  getDeckWithYDocState,
  deleteYDocState,
  hashContent,
} from './db/decks.js';
import { pool } from './db/schema.js';
import { deckToYDoc, yDocToDeck } from '@deckhand/sync';
import type { Deck } from '@deckhand/schema';

/**
 * Load a YDoc for a deck, using hash-based bootstrap logic.
 *
 * If the stored YDoc state's content hash matches the current JSON hash,
 * we use the binary state (faster, preserves collaboration history).
 * Otherwise, we bootstrap fresh from JSON (handles external edits).
 */
export async function loadYDoc(deckId: string): Promise<Y.Doc | null> {
  const result = await getDeckWithYDocState(deckId);
  if (!result) {
    console.log(`[Persistence] Deck ${deckId} not found`);
    return null;
  }

  const { deck: deckRow, ydocState } = result;
  const ydoc = new Y.Doc();

  // Compute current hash of JSON content
  const currentHash = hashContent(deckRow.content);

  if (ydocState && deckRow.content_hash === currentHash) {
    // Hash matches - use binary state (fast path)
    console.log(`[Persistence] Loading ${deckId} from binary state`);
    Y.applyUpdate(ydoc, ydocState);
  } else {
    // Hash mismatch or no binary state - bootstrap from JSON
    console.log(`[Persistence] Bootstrapping ${deckId} from JSON`);
    const deck = JSON.parse(deckRow.content) as Deck;
    deckToYDoc(deck, ydoc);

    // Delete stale YDoc state if it existed
    if (ydocState) {
      await deleteYDocState(deckId);
    }
  }

  return ydoc;
}

/**
 * Save a YDoc to the database.
 * Converts to JSON, computes hash, and saves both binary and JSON atomically.
 * Throws on failure — callers must handle errors.
 */
export async function saveYDoc(deckId: string, ydoc: Y.Doc): Promise<void> {
  // Convert YDoc to deck JSON
  const deck = yDocToDeck(ydoc);

  // Fail-fast on corruption (P4)
  if (!deck || !deck.meta || !deck.slides) {
    throw new Error(`[Persistence] Invalid deck data from YDoc for ${deckId}`);
  }

  // Atomic save: content + YDoc state in a single transaction (P6)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const content = JSON.stringify(deck);
    const contentHash = hashContent(content);
    const slideCount = Object.keys(deck.slides).length;

    const result = await client.query(
      `UPDATE decks
       SET title = $1, description = $2, content = $3, content_hash = $4,
           slide_count = $5, updated_at = NOW()
       WHERE id = $6`,
      [deck.meta.title, deck.meta.description || null, content, contentHash, slideCount, deckId]
    );

    if (result.rowCount === 0) {
      throw new Error(`[Persistence] Deck ${deckId} not found during save`);
    }

    const state = Y.encodeStateAsUpdate(ydoc);
    await client.query(
      `INSERT INTO ydoc_states (deck_id, data, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (deck_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [deckId, Buffer.from(state)]
    );

    await client.query('COMMIT');
    console.log(`[Persistence] Saved ${deckId} (${slideCount} slides)`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Debounced save - waits for activity to stop before saving.
 */
const saveTimers = new Map<string, NodeJS.Timeout>();
const SAVE_DEBOUNCE_MS = 2000;

export function debouncedSaveYDoc(deckId: string, ydoc: Y.Doc): void {
  const existing = saveTimers.get(deckId);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    saveTimers.delete(deckId);
    saveYDoc(deckId, ydoc).catch((error) => {
      console.error(`[Persistence] Debounced save failed for ${deckId}:`, error);
    });
  }, SAVE_DEBOUNCE_MS);

  saveTimers.set(deckId, timer);
}

/**
 * Force immediate save (e.g., on last client disconnect).
 * Throws on failure — callers must handle errors.
 */
export async function flushSave(deckId: string, ydoc: Y.Doc): Promise<void> {
  const existing = saveTimers.get(deckId);
  if (existing) {
    clearTimeout(existing);
    saveTimers.delete(deckId);
  }

  await saveYDoc(deckId, ydoc);
}
