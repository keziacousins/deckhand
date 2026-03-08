/**
 * Deck sharing API routes.
 * All routes require the caller to be the deck owner.
 */

import { Router } from 'express';
import { requireDeckRole } from '../middleware/permissions.js';
import { listDeckShares, upsertDeckShare, deleteDeckShare } from '../db/shares.js';
import { getUserByEmail } from '../db/users.js';

export const sharesRouter = Router({ mergeParams: true });

/**
 * GET /api/decks/:deckId/shares — List shares (owner only)
 */
sharesRouter.get('/', requireDeckRole('owner'), async (req, res) => {
  try {
    const shares = await listDeckShares(req.params.deckId);
    res.json(shares);
  } catch (error) {
    console.error('[API] Error listing shares:', error);
    res.status(500).json({ error: 'Failed to list shares' });
  }
});

/**
 * POST /api/decks/:deckId/shares — Add or update a share (owner only)
 * Body: { email: string, role: 'viewer' | 'editor' }
 */
sharesRouter.post('/', requireDeckRole('owner'), async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role || !['viewer', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'email and role (viewer|editor) are required' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const share = await upsertDeckShare(req.params.deckId, user.id, role);
    res.status(201).json({
      id: share.id,
      userId: share.user_id,
      email: user.email,
      name: user.name,
      role: share.role,
      createdAt: share.created_at,
    });
  } catch (error) {
    console.error('[API] Error creating share:', error);
    res.status(500).json({ error: 'Failed to create share' });
  }
});

/**
 * PATCH /api/decks/:deckId/shares/:shareId — Update share role (owner only)
 * Body: { role: 'viewer' | 'editor' }
 */
sharesRouter.patch('/:shareId', requireDeckRole('owner'), async (req, res) => {
  try {
    const { role } = req.body;

    if (!role || !['viewer', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'role (viewer|editor) is required' });
    }

    // Delete and re-create to update role (upsert handles this)
    // But we need the user_id from the existing share first
    const shares = await listDeckShares(req.params.deckId);
    const existing = shares.find((s) => s.id === req.params.shareId);
    if (!existing) {
      return res.status(404).json({ error: 'Share not found' });
    }

    const share = await upsertDeckShare(req.params.deckId, existing.userId, role);
    res.json({
      id: share.id,
      userId: share.user_id,
      email: existing.email,
      name: existing.name,
      role: share.role,
      createdAt: share.created_at,
    });
  } catch (error) {
    console.error('[API] Error updating share:', error);
    res.status(500).json({ error: 'Failed to update share' });
  }
});

/**
 * DELETE /api/decks/:deckId/shares/:shareId — Remove a share (owner only)
 */
sharesRouter.delete('/:shareId', requireDeckRole('owner'), async (req, res) => {
  try {
    const deleted = await deleteDeckShare(req.params.shareId);
    if (!deleted) {
      return res.status(404).json({ error: 'Share not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('[API] Error deleting share:', error);
    res.status(500).json({ error: 'Failed to delete share' });
  }
});
