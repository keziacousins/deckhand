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
import { jwtMiddleware } from './middleware/auth.js';
import { getAllSessions } from './sessions.js';

interface AppOptions {
  skipAuth?: boolean;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  // JSON body parsing
  app.use(express.json());

  // CORS for development
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Auth routes (before JWT middleware — these ARE the auth flow)
  app.use('/api/auth', authRouter);

  // JWT middleware for all subsequent /api routes — requires valid token
  if (!options.skipAuth) {
    app.use('/api', jwtMiddleware);
  }

  // Sessions endpoint
  app.get('/api/sessions', (_req, res) => {
    res.json(getAllSessions());
  });

  // Deck routes
  app.use('/api/decks', decksRouter);

  // Share routes
  app.use('/api/decks/:deckId/shares', sharesRouter);

  // Asset routes (includes /api/decks/:deckId/assets paths)
  app.use('/api', assetsRouter);

  // Chat routes
  app.use('/api/decks', chatRouter);

  // Models routes
  app.use('/api/models', modelsRouter);

  return app;
}
