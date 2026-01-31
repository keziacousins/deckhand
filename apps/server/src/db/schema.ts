/**
 * Database schema for Deckhand.
 * Uses SQLite with better-sqlite3 for simplicity.
 */

import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/deckhand.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db: DatabaseType = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * Initialize the database schema
 */
export function initSchema(): void {
  db.exec(`
    -- Decks table: stores deck metadata and JSON content
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL,           -- JSON content (source of truth)
      content_hash TEXT NOT NULL,      -- SHA-256 hash for bootstrap detection
      slide_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- YDoc states table: ephemeral collaboration state
    CREATE TABLE IF NOT EXISTS ydoc_states (
      deck_id TEXT PRIMARY KEY,
      data BLOB NOT NULL,              -- Binary Y.Doc state
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );

    -- Index for listing decks by updated time
    CREATE INDEX IF NOT EXISTS idx_decks_updated_at ON decks(updated_at DESC);
  `);

  console.log('[DB] Schema initialized');
}

/**
 * Deck metadata returned from list queries
 */
export interface DeckMetadata {
  id: string;
  title: string;
  description: string | null;
  slideCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Full deck row from database
 */
export interface DeckRow {
  id: string;
  title: string;
  description: string | null;
  content: string;
  content_hash: string;
  slide_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * YDoc state row
 */
export interface YDocStateRow {
  deck_id: string;
  data: Buffer;
  updated_at: string;
}
