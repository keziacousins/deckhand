/**
 * Deck CRUD API routes.
 */

import { Router } from 'express';
import {
  listDecks,
  getDeck,
  createDeck,
  updateDeckContent,
  updateDeckMetadata,
  deleteDeck,
  duplicateDeck,
} from '../db/decks.js';
import { createEmptyDeck, generateDeckId, validateDeck } from '@deckhand/schema';
import { closeSession } from '../sessions.js';
import { deleteByPrefix } from '../storage.js';
import { getAuthUser } from '../middleware/auth.js';
import { requireDeckRole } from '../middleware/permissions.js';

export const decksRouter = Router();

/**
 * GET /api/decks - List decks the user owns or has access to
 */
decksRouter.get('/', async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const decks = await listDecks(user.sub);
    res.json(decks);
  } catch (error) {
    console.error('[API] Error listing decks:', error);
    res.status(500).json({ error: 'Failed to list decks' });
  }
});

/**
 * GET /api/decks/:id - Get a single deck (viewer+)
 */
decksRouter.get('/:id', requireDeckRole('owner', 'editor', 'viewer'), async (req, res) => {
  try {
    const deck = await getDeck(req.params.id);
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }
    res.json({
      id: deck.id,
      title: deck.title,
      description: deck.description,
      content: JSON.parse(deck.content),
      slideCount: deck.slide_count,
      role: req.deckRole,
      publicAccess: deck.public_access,
      createdAt: deck.created_at,
      updatedAt: deck.updated_at,
    });
  } catch (error) {
    console.error('[API] Error getting deck:', error);
    res.status(500).json({ error: 'Failed to get deck' });
  }
});

/**
 * POST /api/decks - Create a new deck (any authenticated user)
 */
decksRouter.post('/', async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const { title, description } = req.body;

    const deck = createEmptyDeck(title || 'Untitled Deck');
    if (description) {
      deck.meta.description = description;
    }

    const row = await createDeck(deck, user.sub);
    res.status(201).json({
      id: row.id,
      title: row.title,
      description: row.description,
      slideCount: row.slide_count,
      role: 'owner',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('[API] Error creating deck:', error);
    res.status(500).json({ error: 'Failed to create deck' });
  }
});

/**
 * PUT /api/decks/:id - Update deck content (editor+)
 */
decksRouter.put('/:id', requireDeckRole('owner', 'editor'), async (req, res) => {
  try {
    const { content } = req.body;

    const validation = validateDeck(content);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid deck content',
        details: validation.errors.issues,
      });
    }

    const row = await updateDeckContent(req.params.id, validation.data);
    if (!row) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      slideCount: row.slide_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('[API] Error updating deck:', error);
    res.status(500).json({ error: 'Failed to update deck' });
  }
});

/**
 * PATCH /api/decks/:id - Update deck metadata only (editor+)
 */
decksRouter.patch('/:id', requireDeckRole('owner', 'editor'), async (req, res) => {
  try {
    const { title, description } = req.body;

    const row = await updateDeckMetadata(req.params.id, { title, description });
    if (!row) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    res.json({
      id: row.id,
      title: row.title,
      description: row.description,
      slideCount: row.slide_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('[API] Error updating deck metadata:', error);
    res.status(500).json({ error: 'Failed to update deck metadata' });
  }
});

/**
 * DELETE /api/decks/:id - Delete a deck (owner only)
 */
decksRouter.delete('/:id', requireDeckRole('owner'), async (req, res) => {
  try {
    const deckId = req.params.id;

    // Force-close any active sessions — owner is deleting the deck
    closeSession(deckId);

    // Delete all S3 objects for this deck (assets, covers, variants)
    await deleteByPrefix(`${deckId}/`);

    const deleted = await deleteDeck(deckId);
    if (!deleted) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('[API] Error deleting deck:', error);
    res.status(500).json({ error: 'Failed to delete deck' });
  }
});

/**
 * PATCH /api/decks/:id/public - Toggle public access (owner only)
 */
decksRouter.patch('/:id/public', requireDeckRole('owner'), async (req, res) => {
  try {
    const { publicAccess } = req.body;
    if (!publicAccess || !['none', 'present'].includes(publicAccess)) {
      return res.status(400).json({ error: 'publicAccess must be "none" or "present"' });
    }

    const result = await import('../db/schema.js').then(({ pool }) =>
      pool.query(
        'UPDATE decks SET public_access = $1, updated_at = NOW() WHERE id = $2 RETURNING public_access',
        [publicAccess, req.params.id]
      )
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    res.json({ publicAccess: result.rows[0].public_access });
  } catch (error) {
    console.error('[API] Error updating public access:', error);
    res.status(500).json({ error: 'Failed to update public access' });
  }
});

/**
 * POST /api/decks/:id/duplicate - Duplicate a deck (viewer+, new deck owned by current user)
 */
decksRouter.post('/:id/duplicate', requireDeckRole('owner', 'editor', 'viewer'), async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const newId = generateDeckId();
    const row = await duplicateDeck(req.params.id, newId, user.sub);

    if (!row) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    res.status(201).json({
      id: row.id,
      title: row.title,
      description: row.description,
      slideCount: row.slide_count,
      role: 'owner',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('[API] Error duplicating deck:', error);
    res.status(500).json({ error: 'Failed to duplicate deck' });
  }
});
