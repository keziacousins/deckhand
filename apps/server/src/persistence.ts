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
  updateDeckContent,
  saveYDocState,
  deleteYDocState,
  hashContent,
} from './db/decks.js';
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
 * Converts to JSON, computes hash, and saves both binary and JSON.
 */
export async function saveYDoc(deckId: string, ydoc: Y.Doc): Promise<void> {
  try {
    // Convert YDoc to deck JSON
    const deck = yDocToDeck(ydoc);

    // Validate we got valid data
    if (!deck || !deck.meta || !deck.slides) {
      console.error(`[Persistence] Invalid deck data from YDoc for ${deckId}`);
      return;
    }

    // Update the deck content in database
    const updated = await updateDeckContent(deckId, deck);
    if (!updated) {
      console.error(`[Persistence] Failed to update deck ${deckId}`);
      return;
    }

    // Save binary YDoc state
    const state = Y.encodeStateAsUpdate(ydoc);
    await saveYDocState(deckId, Buffer.from(state));

    console.log(`[Persistence] Saved ${deckId} (${Object.keys(deck.slides).length} slides)`);
  } catch (error) {
    console.error(`[Persistence] Error saving ${deckId}:`, error);
  }
}

/**
 * Debounced save - waits for activity to stop before saving.
 */
const saveTimers = new Map<string, NodeJS.Timeout>();
const SAVE_DEBOUNCE_MS = 2000;

export function debouncedSaveYDoc(deckId: string, ydoc: Y.Doc): void {
  // Clear existing timer
  const existing = saveTimers.get(deckId);
  if (existing) {
    clearTimeout(existing);
  }

  // Set new timer
  const timer = setTimeout(async () => {
    saveTimers.delete(deckId);
    await saveYDoc(deckId, ydoc);
  }, SAVE_DEBOUNCE_MS);

  saveTimers.set(deckId, timer);
}

/**
 * Force immediate save (e.g., on last client disconnect).
 */
export async function flushSave(deckId: string, ydoc: Y.Doc): Promise<void> {
  // Clear any pending debounced save
  const existing = saveTimers.get(deckId);
  if (existing) {
    clearTimeout(existing);
    saveTimers.delete(deckId);
  }

  // Save immediately
  await saveYDoc(deckId, ydoc);
}
