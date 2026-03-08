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
import { getActiveSession } from '../sessions.js';

export const decksRouter = Router();

/**
 * GET /api/decks - List all decks
 */
decksRouter.get('/', async (_req, res) => {
  try {
    const decks = await listDecks();
    res.json(decks);
  } catch (error) {
    console.error('[API] Error listing decks:', error);
    res.status(500).json({ error: 'Failed to list decks' });
  }
});

/**
 * GET /api/decks/:id - Get a single deck
 */
decksRouter.get('/:id', async (req, res) => {
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
      createdAt: deck.created_at,
      updatedAt: deck.updated_at,
    });
  } catch (error) {
    console.error('[API] Error getting deck:', error);
    res.status(500).json({ error: 'Failed to get deck' });
  }
});

/**
 * POST /api/decks - Create a new deck
 */
decksRouter.post('/', async (req, res) => {
  try {
    const { title, description } = req.body;

    const deck = createEmptyDeck(title || 'Untitled Deck');
    if (description) {
      deck.meta.description = description;
    }

    const row = await createDeck(deck);
    res.status(201).json({
      id: row.id,
      title: row.title,
      description: row.description,
      slideCount: row.slide_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('[API] Error creating deck:', error);
    res.status(500).json({ error: 'Failed to create deck' });
  }
});

/**
 * PUT /api/decks/:id - Update deck content
 */
decksRouter.put('/:id', async (req, res) => {
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
 * PATCH /api/decks/:id - Update deck metadata only
 */
decksRouter.patch('/:id', async (req, res) => {
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
 * DELETE /api/decks/:id - Delete a deck
 */
decksRouter.delete('/:id', async (req, res) => {
  try {
    const session = getActiveSession(req.params.id);
    if (session) {
      return res.status(409).json({
        error: 'Cannot delete deck with active editing session',
        activeClients: session.clients.size,
      });
    }

    const deleted = await deleteDeck(req.params.id);
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
 * POST /api/decks/:id/duplicate - Duplicate a deck
 */
decksRouter.post('/:id/duplicate', async (req, res) => {
  try {
    const newId = generateDeckId();
    const row = await duplicateDeck(req.params.id, newId);

    if (!row) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    res.status(201).json({
      id: row.id,
      title: row.title,
      description: row.description,
      slideCount: row.slide_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('[API] Error duplicating deck:', error);
    res.status(500).json({ error: 'Failed to duplicate deck' });
  }
});
