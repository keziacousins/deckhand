/**
 * API integration tests for deck endpoints.
 * Requires Docker Postgres running on port 5433.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createEmptyDeck } from '@deckhand/schema';
import { pool, initSchema } from '../db/schema.js';
import type { Express } from 'express';

let app: Express;
let pgAvailable = false;

async function clearTestData(): Promise<void> {
  await pool.query('DELETE FROM chat_messages');
  await pool.query('DELETE FROM chat_sessions');
  await pool.query('DELETE FROM assets');
  await pool.query('DELETE FROM ydoc_states');
  await pool.query('DELETE FROM decks');
  await pool.query('DELETE FROM users');
}

async function insertTestDeck(deck: ReturnType<typeof createEmptyDeck>): Promise<void> {
  const content = JSON.stringify(deck);
  await pool.query(
    `INSERT INTO decks (id, title, description, content, content_hash, slide_count)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      deck.meta.id,
      deck.meta.title,
      deck.meta.description || null,
      content,
      'test-hash',
      Object.keys(deck.slides).length,
    ]
  );
}

describe('API Integration Tests', () => {
  beforeAll(async () => {
    try {
      await pool.query('SELECT 1');
      pgAvailable = true;
    } catch {
      console.warn('Postgres not available at DATABASE_URL, skipping tests');
      return;
    }
    await initSchema();
    app = createApp();
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async (ctx) => {
    if (!pgAvailable) {
      ctx.skip();
      return;
    }
    await clearTestData();
  });

  describe('GET /api/health', () => {
    it('returns ok status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /api/decks', () => {
    it('returns empty array when no decks exist', async () => {
      const res = await request(app).get('/api/decks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns list of decks', async () => {
      const deck1 = createEmptyDeck('First Deck');
      const deck2 = createEmptyDeck('Second Deck');
      await insertTestDeck(deck1);
      await insertTestDeck(deck2);

      const res = await request(app).get('/api/decks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((d: { title: string }) => d.title)).toContain('First Deck');
      expect(res.body.map((d: { title: string }) => d.title)).toContain('Second Deck');
    });

    it('returns decks with metadata', async () => {
      const deck = createEmptyDeck('With Metadata');
      deck.meta.description = 'Test description';
      await insertTestDeck(deck);

      const res = await request(app).get('/api/decks');
      expect(res.status).toBe(200);
      expect(res.body[0].id).toBe(deck.meta.id);
      expect(res.body[0].title).toBe('With Metadata');
      expect(res.body[0].slideCount).toBe(1);
      expect(res.body[0].createdAt).toBeDefined();
      expect(res.body[0].updatedAt).toBeDefined();
    });
  });

  describe('GET /api/decks/:id', () => {
    it('returns 404 for non-existent deck', async () => {
      const res = await request(app).get('/api/decks/non-existent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Deck not found');
    });

    it('returns deck by id', async () => {
      const deck = createEmptyDeck('My Deck');
      await insertTestDeck(deck);

      const res = await request(app).get(`/api/decks/${deck.meta.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(deck.meta.id);
      expect(res.body.title).toBe('My Deck');
      expect(res.body.content).toBeDefined();
      expect(res.body.content.meta.title).toBe('My Deck');
    });

    it('returns deck content as parsed JSON', async () => {
      const deck = createEmptyDeck('JSON Test');
      await insertTestDeck(deck);

      const res = await request(app).get(`/api/decks/${deck.meta.id}`);
      expect(typeof res.body.content).toBe('object');
      expect(res.body.content.slides).toBeDefined();
      expect(res.body.content.theme).toBeDefined();
    });
  });

  describe('POST /api/decks', () => {
    it('creates a new deck with title', async () => {
      const res = await request(app)
        .post('/api/decks')
        .send({ title: 'New Deck' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Deck');
      expect(res.body.id).toMatch(/^deck-/);
      expect(res.body.slideCount).toBe(1);
    });

    it('creates deck with default title if not provided', async () => {
      const res = await request(app)
        .post('/api/decks')
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Untitled Deck');
    });

    it('creates deck with description', async () => {
      const res = await request(app)
        .post('/api/decks')
        .send({ title: 'With Desc', description: 'A test deck' });

      expect(res.status).toBe(201);
      expect(res.body.description).toBe('A test deck');
    });

    it('creates deck retrievable via GET', async () => {
      const createRes = await request(app)
        .post('/api/decks')
        .send({ title: 'Retrievable' });

      const getRes = await request(app)
        .get(`/api/decks/${createRes.body.id}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.title).toBe('Retrievable');
    });
  });

  describe('PUT /api/decks/:id', () => {
    it('returns 404 for non-existent deck', async () => {
      const deck = createEmptyDeck('Test');
      const res = await request(app)
        .put('/api/decks/non-existent')
        .send({ content: deck });

      expect(res.status).toBe(404);
    });

    it('updates deck content', async () => {
      const deck = createEmptyDeck('Original');
      await insertTestDeck(deck);

      const updatedDeck = { ...deck, meta: { ...deck.meta, title: 'Updated' } };
      const res = await request(app)
        .put(`/api/decks/${deck.meta.id}`)
        .send({ content: updatedDeck });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
    });

    it('returns 400 for invalid content', async () => {
      const deck = createEmptyDeck('Test');
      await insertTestDeck(deck);

      const res = await request(app)
        .put(`/api/decks/${deck.meta.id}`)
        .send({ content: { invalid: 'data' } });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid deck content');
    });

    it('updates slide count when slides change', async () => {
      const deck = createEmptyDeck('Test');
      await insertTestDeck(deck);

      const slideId = `slide-new-${Date.now()}`;
      const updatedDeck = {
        ...deck,
        slides: {
          ...deck.slides,
          [slideId]: {
            id: slideId,
            title: 'New Slide',
            components: [],
            position: { x: 900, y: 0 },
          },
        },
      };

      const res = await request(app)
        .put(`/api/decks/${deck.meta.id}`)
        .send({ content: updatedDeck });

      expect(res.status).toBe(200);
      expect(res.body.slideCount).toBe(2);
    });
  });

  describe('PATCH /api/decks/:id', () => {
    it('returns 404 for non-existent deck', async () => {
      const res = await request(app)
        .patch('/api/decks/non-existent')
        .send({ title: 'New Title' });

      expect(res.status).toBe(404);
    });

    it('updates deck title', async () => {
      const deck = createEmptyDeck('Old Title');
      await insertTestDeck(deck);

      const res = await request(app)
        .patch(`/api/decks/${deck.meta.id}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New Title');
    });

    it('updates deck description', async () => {
      const deck = createEmptyDeck('Test');
      await insertTestDeck(deck);

      const res = await request(app)
        .patch(`/api/decks/${deck.meta.id}`)
        .send({ description: 'New description' });

      expect(res.status).toBe(200);
      expect(res.body.description).toBe('New description');
    });

    it('updates both title and description', async () => {
      const deck = createEmptyDeck('Test');
      await insertTestDeck(deck);

      const res = await request(app)
        .patch(`/api/decks/${deck.meta.id}`)
        .send({ title: 'New Title', description: 'New Desc' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New Title');
      expect(res.body.description).toBe('New Desc');
    });
  });

  describe('DELETE /api/decks/:id', () => {
    it('returns 404 for non-existent deck', async () => {
      const res = await request(app).delete('/api/decks/non-existent');
      expect(res.status).toBe(404);
    });

    it('deletes existing deck', async () => {
      const deck = createEmptyDeck('To Delete');
      await insertTestDeck(deck);

      const deleteRes = await request(app).delete(`/api/decks/${deck.meta.id}`);
      expect(deleteRes.status).toBe(204);

      const getRes = await request(app).get(`/api/decks/${deck.meta.id}`);
      expect(getRes.status).toBe(404);
    });

    it('removes deck from list', async () => {
      const deck = createEmptyDeck('To Delete');
      await insertTestDeck(deck);

      await request(app).delete(`/api/decks/${deck.meta.id}`);

      const listRes = await request(app).get('/api/decks');
      expect(listRes.body).toHaveLength(0);
    });
  });

  describe('POST /api/decks/:id/duplicate', () => {
    it('returns 404 for non-existent deck', async () => {
      const res = await request(app).post('/api/decks/non-existent/duplicate');
      expect(res.status).toBe(404);
    });

    it('duplicates existing deck', async () => {
      const deck = createEmptyDeck('Original');
      await insertTestDeck(deck);

      const res = await request(app).post(`/api/decks/${deck.meta.id}/duplicate`);
      expect(res.status).toBe(201);
      expect(res.body.id).not.toBe(deck.meta.id);
      expect(res.body.title).toBe('Original (copy)');
    });

    it('creates independent copy', async () => {
      const deck = createEmptyDeck('Original');
      await insertTestDeck(deck);

      const dupRes = await request(app).post(`/api/decks/${deck.meta.id}/duplicate`);

      // Modify the original
      await request(app)
        .patch(`/api/decks/${deck.meta.id}`)
        .send({ title: 'Modified Original' });

      // Check duplicate is unchanged
      const getRes = await request(app).get(`/api/decks/${dupRes.body.id}`);
      expect(getRes.body.title).toBe('Original (copy)');
    });
  });

  describe('GET /api/sessions', () => {
    it('returns sessions list', async () => {
      const res = await request(app).get('/api/sessions');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('CORS', () => {
    it('includes CORS headers', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    it('handles OPTIONS preflight', async () => {
      const res = await request(app).options('/api/decks');
      expect(res.status).toBe(200);
    });
  });
});
