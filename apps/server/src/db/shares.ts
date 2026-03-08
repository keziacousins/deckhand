/**
 * Deck sharing operations.
 */

import crypto from 'node:crypto';
import { pool, type DeckRole, type DeckShareRow } from './schema.js';

/**
 * Resolve a user's role for a given deck.
 * Returns 'owner' | 'editor' | 'viewer' | null.
 */
export async function getDeckRole(
  deckId: string,
  userId: string | undefined
): Promise<DeckRole | null> {
  if (!userId) return null;

  // Check ownership first
  const ownerResult = await pool.query(
    'SELECT owner_id FROM decks WHERE id = $1',
    [deckId]
  );
  if (ownerResult.rows.length === 0) return null;
  if (ownerResult.rows[0].owner_id === userId) return 'owner';

  // Check shares
  const shareResult = await pool.query(
    'SELECT role FROM deck_shares WHERE deck_id = $1 AND user_id = $2',
    [deckId, userId]
  );
  if (shareResult.rows.length === 0) return null;
  return shareResult.rows[0].role as DeckRole;
}

/**
 * List all shares for a deck, with user info.
 */
export async function listDeckShares(
  deckId: string
): Promise<Array<{ id: string; userId: string; email: string; name: string | null; role: string; createdAt: string }>> {
  const result = await pool.query(
    `SELECT ds.id, ds.user_id, u.email, u.name, ds.role, ds.created_at
     FROM deck_shares ds
     JOIN users u ON u.id = ds.user_id
     WHERE ds.deck_id = $1
     ORDER BY ds.created_at`,
    [deckId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    email: r.email,
    name: r.name,
    role: r.role,
    createdAt: r.created_at,
  }));
}

/**
 * Create or update a share. Returns the share row.
 */
export async function upsertDeckShare(
  deckId: string,
  userId: string,
  role: 'viewer' | 'editor'
): Promise<DeckShareRow> {
  const id = crypto.randomUUID();
  const result = await pool.query(
    `INSERT INTO deck_shares (id, deck_id, user_id, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (deck_id, user_id) DO UPDATE SET role = $4
     RETURNING *`,
    [id, deckId, userId, role]
  );
  return result.rows[0];
}

/**
 * Delete a share by ID.
 */
export async function deleteDeckShare(shareId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM deck_shares WHERE id = $1',
    [shareId]
  );
  return (result.rowCount ?? 0) > 0;
}
