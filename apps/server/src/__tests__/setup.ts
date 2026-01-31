/**
 * Test setup for server integration tests.
 * Uses an in-memory SQLite database for isolation.
 */

import Database from 'better-sqlite3';
import { beforeAll, afterAll, beforeEach } from 'vitest';

// Store original db reference
let originalDb: Database.Database | null = null;

// Test database (in-memory)
let testDb: Database.Database;

/**
 * Initialize test database schema
 */
function initTestSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      slide_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ydoc_states (
      deck_id TEXT PRIMARY KEY,
      data BLOB NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_decks_updated_at ON decks(updated_at DESC);
  `);
}

/**
 * Clear all data from test tables
 */
export function clearTestData(): void {
  testDb.exec('DELETE FROM ydoc_states');
  testDb.exec('DELETE FROM decks');
}

/**
 * Get the test database instance
 */
export function getTestDb(): Database.Database {
  return testDb;
}

// Setup hooks need to be called from test files
export function setupTestDatabase(): void {
  beforeAll(async () => {
    // Create in-memory database for tests
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    initTestSchema(testDb);

    // Replace the db module's export
    // This is a bit hacky but works for our purposes
    const schemaModule = await import('../db/schema.js');
    originalDb = (schemaModule as { db: Database.Database }).db;
    (schemaModule as { db: Database.Database }).db = testDb;
  });

  afterAll(() => {
    testDb.close();
  });

  beforeEach(() => {
    clearTestData();
  });
}
