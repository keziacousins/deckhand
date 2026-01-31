/**
 * Express app factory for Deckhand server.
 * Separated from index.ts to allow testing.
 */

import express, { type Express } from 'express';
import { decksRouter } from './routes/decks.js';
import { getAllSessions } from './sessions.js';

export function createApp(): Express {
  const app = express();

  // JSON body parsing
  app.use(express.json());

  // CORS for development
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Sessions endpoint
  app.get('/api/sessions', (_req, res) => {
    res.json(getAllSessions());
  });

  // Deck routes
  app.use('/api/decks', decksRouter);

  return app;
}
