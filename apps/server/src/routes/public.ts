/**
 * Public (unauthenticated) routes for viewing shared presentations.
 * Mounted before JWT middleware so no token is required.
 */

import { Router, type Request, type Response } from 'express';
import { getDeck } from '../db/decks.js';
import { pool, type AssetRow } from '../db/schema.js';
import { getObject } from '../storage.js';

export const publicRouter = Router();

/**
 * GET /api/public/decks/:id — Get a public deck's content
 */
publicRouter.get('/decks/:id', async (req: Request, res: Response) => {
  try {
    const deck = await getDeck(req.params.id);
    if (!deck || deck.public_access === 'none') {
      return res.status(404).json({ error: 'Deck not found' });
    }

    res.json({
      id: deck.id,
      title: deck.title,
      content: JSON.parse(deck.content),
      role: 'viewer' as const,
    });
  } catch (error) {
    console.error('[Public] Error getting deck:', error);
    res.status(500).json({ error: 'Failed to get deck' });
  }
});

/**
 * GET /api/public/decks/:deckId/assets/:assetId — Serve an asset from a public deck
 */
publicRouter.get('/decks/:deckId/assets/:assetId', async (req: Request, res: Response) => {
  const { deckId, assetId } = req.params;

  try {
    // Verify deck is public
    const deck = await getDeck(deckId);
    if (!deck || deck.public_access === 'none') {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM assets WHERE id = $1 AND deck_id = $2',
      [assetId, deckId]
    );
    const row = rows[0] as AssetRow | undefined;

    if (!row) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const { body, contentType } = await getObject(row.storage_key);
    res.setHeader('Content-Type', contentType || row.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    body.pipe(res);
  } catch (error) {
    console.error('[Public] Error serving asset:', error);
    res.status(500).json({ error: 'Failed to serve asset' });
  }
});
