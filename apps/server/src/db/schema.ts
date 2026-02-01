/**
 * Database schema for Deckhand.
 * Uses SQLite with better-sqlite3 for simplicity.
 */

import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { paths, ensureDirectories } from '../config.js';

// Ensure directories exist before opening database
ensureDirectories();

export const db: DatabaseType = new Database(paths.dbFile);

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

    -- Assets table: stores asset metadata (files stored on disk)
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL,
      filename TEXT NOT NULL,          -- Original filename
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,           -- File size in bytes
      width INTEGER,                   -- Image width (if applicable)
      height INTEGER,                  -- Image height (if applicable)
      has_thumbnail INTEGER DEFAULT 0, -- Whether a thumbnail was generated
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );

    -- Index for listing decks by updated time
    CREATE INDEX IF NOT EXISTS idx_decks_updated_at ON decks(updated_at DESC);
    
    -- Index for listing assets by deck
    CREATE INDEX IF NOT EXISTS idx_assets_deck_id ON assets(deck_id);
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

/**
 * Asset row from database
 */
export interface AssetRow {
  id: string;
  deck_id: string;
  filename: string;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  has_thumbnail: number;
  created_at: string;
}
