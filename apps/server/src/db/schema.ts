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
      cover_url TEXT,                  -- URL to cover image (generated from cover slide)
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

    -- Chat sessions table: groups chat messages into conversations
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL,
      title TEXT,                      -- Auto-generated or user-provided title
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );

    -- Chat messages table: stores chat history per session
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,        -- References chat_sessions
      deck_id TEXT NOT NULL,           -- Denormalized for easier queries
      role TEXT NOT NULL,              -- 'user' or 'assistant'
      content TEXT NOT NULL,
      model TEXT,                      -- Model used (for assistant messages)
      tool_results TEXT,               -- JSON array of tool results
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );

    -- Index for listing decks by updated time
    CREATE INDEX IF NOT EXISTS idx_decks_updated_at ON decks(updated_at DESC);
    
    -- Index for listing assets by deck
    CREATE INDEX IF NOT EXISTS idx_assets_deck_id ON assets(deck_id);

    -- Index for listing chat sessions by deck
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_deck_id ON chat_sessions(deck_id, updated_at DESC);

    -- Index for listing chat messages by session
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id, created_at);
  `);

  // Migrations for existing databases
  // Add cover_url column if it doesn't exist
  const columns = db.prepare("PRAGMA table_info(decks)").all() as Array<{ name: string }>;
  if (!columns.some(c => c.name === 'cover_url')) {
    db.exec('ALTER TABLE decks ADD COLUMN cover_url TEXT');
    console.log('[DB] Added cover_url column to decks table');
  }

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
  coverUrl: string | null;
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
  cover_url: string | null;
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

/**
 * Chat session row from database
 */
export interface ChatSessionRow {
  id: string;
  deck_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Chat message row from database
 */
export interface ChatMessageRow {
  id: string;
  session_id: string;
  deck_id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  tool_results: string | null;
  created_at: string;
}
