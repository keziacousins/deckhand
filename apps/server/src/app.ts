/**
 * Express app factory for Deckhand server.
 * Separated from index.ts to allow testing.
 */

import express, { type Express } from 'express';
import { decksRouter } from './routes/decks.js';
import assetsRouter from './routes/assets.js';
import chatRouter from './routes/chat.js';
import modelsRouter from './routes/models.js';
import { authRouter } from './routes/auth.js';
import { sharesRouter } from './routes/shares.js';
import { publicRouter } from './routes/public.js';
import { meRouter, avatarsRouter } from './routes/me.js';
import { jwtMiddleware } from './middleware/auth.js';
import { getAllSessions } from './sessions.js';
import { pool } from './db/schema.js';
import { allowedOrigins } from './config.js';

interface AppOptions {
  skipAuth?: boolean;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  // JSON body parsing
  app.use(express.json());

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check — verifies DB connectivity and reports session count
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      const sessions = getAllSessions();
      res.json({ status: 'ok', db: true, activeSessions: sessions.length });
    } catch (error) {
      console.error('[Health] DB check failed:', error);
      res.status(503).json({ status: 'degraded', db: false, error: 'Database unreachable' });
    }
  });

  // Auth routes (before JWT middleware — these ARE the auth flow)
  app.use('/api/auth', authRouter);

  // Public routes (before JWT middleware — no auth required)
  app.use('/api/public', publicRouter);

  // Avatar serving (before JWT — loaded by <img> tags which can't send Authorization headers)
  // User IDs are UUIDs, so URLs are unguessable
  app.use('/api/avatars', avatarsRouter);

  // JWT middleware for all subsequent /api routes — requires valid token
  if (!options.skipAuth) {
    app.use('/api', jwtMiddleware);
  }

  // User profile
  app.use('/api/me', meRouter);

  // Sessions endpoint
  app.get('/api/sessions', (_req, res) => {
    res.json(getAllSessions());
  });

  // Share routes (before decks router so /api/decks/:deckId/shares matches first)
  app.use('/api/decks/:deckId/shares', sharesRouter);

  // Deck routes
  app.use('/api/decks', decksRouter);

  // Asset routes (includes /api/decks/:deckId/assets paths)
  app.use('/api', assetsRouter);

  // Chat routes
  app.use('/api/decks', chatRouter);

  // Models routes
  app.use('/api/models', modelsRouter);

  return app;
}
