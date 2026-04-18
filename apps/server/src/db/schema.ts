/**
 * Database schema for Deckhand.
 * Uses PostgreSQL via pg.
 */

import pg from 'pg';
import { dbConfig } from '../config.js';

// Lazy pool — resolves DB URL at first use so tests can set env vars
// after module import. Subsequent calls return the same pool instance.
let _pool: pg.Pool | null = null;

function createPool(): pg.Pool {
  return new pg.Pool({
    connectionString: dbConfig.connectionString,
    max: 10,
    // Fail fast when pool is exhausted rather than waiting forever.
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    // Kill queries that hang at the DB level (e.g. lock waits).
    statement_timeout: 30_000,
    query_timeout: 30_000,
  });
}

export function getPool(): pg.Pool {
  if (!_pool) _pool = createPool();
  return _pool;
}

// Backwards-compatible export — `pool.query(...)` just delegates to getPool().
export const pool = {
  query: ((...args: Parameters<pg.Pool['query']>) => getPool().query(...args)) as pg.Pool['query'],
  connect: () => getPool().connect(),
  end: () => (_pool ? _pool.end() : Promise.resolve()),
} as unknown as pg.Pool;

/**
 * Initialize the database schema
 */
export async function initSchema(): Promise<void> {
  await pool.query(`
    -- Users table: mirrors Kratos identity, caches display info
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Decks table: stores deck metadata and JSON content
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      slide_count INTEGER DEFAULT 0,
      cover_url TEXT,
      cover_storage_key TEXT,
      owner_id TEXT,
      org_id TEXT,
      public_access TEXT NOT NULL DEFAULT 'none',
      require_login_for_public BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- YDoc states table: ephemeral collaboration state
    CREATE TABLE IF NOT EXISTS ydoc_states (
      deck_id TEXT PRIMARY KEY REFERENCES decks(id) ON DELETE CASCADE,
      data BYTEA NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Assets table: stores asset metadata (files in S3)
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      has_thumbnail BOOLEAN DEFAULT FALSE,
      storage_key TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Chat sessions table
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      title TEXT,
      api_messages TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Chat messages table
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      model TEXT,
      tool_results TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Deck shares table: per-user access grants
    CREATE TABLE IF NOT EXISTS deck_shares (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(deck_id, user_id)
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_decks_updated_at ON decks(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_decks_owner_id ON decks(owner_id);
    CREATE INDEX IF NOT EXISTS idx_deck_shares_user ON deck_shares(user_id);
    CREATE INDEX IF NOT EXISTS idx_deck_shares_deck ON deck_shares(deck_id);
    CREATE INDEX IF NOT EXISTS idx_assets_deck_id ON assets(deck_id);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_deck_id ON chat_sessions(deck_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id, created_at);

    -- Migrations
    ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS api_messages TEXT;
    ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS model TEXT;
    ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS segments TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_storage_key TEXT;
    ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id TEXT;
    ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_name TEXT;
  `);

  console.log('[DB] Schema initialized');
}

/**
 * User row from database
 */
export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  avatar_storage_key: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Deck metadata returned from list queries
 */
export type DeckRole = 'owner' | 'editor' | 'viewer';

export interface DeckMetadata {
  id: string;
  title: string;
  description: string | null;
  slideCount: number;
  coverUrl: string | null;
  role: DeckRole;
  createdAt: string;
  updatedAt: string;
}

export interface DeckShareRow {
  id: string;
  deck_id: string;
  user_id: string;
  role: 'viewer' | 'editor';
  created_at: string;
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
  cover_storage_key: string | null;
  public_access: string;
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
  has_thumbnail: boolean;
  storage_key: string;
  created_at: string;
}

/**
 * Chat session row from database
 */
export interface ChatSessionRow {
  id: string;
  deck_id: string;
  title: string | null;
  model: string | null;
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
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}
