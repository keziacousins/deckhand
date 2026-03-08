/**
 * Test setup for server integration tests.
 * Uses the Docker Postgres instance for realistic testing.
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { pool, initSchema } from '../db/schema.js';

/**
 * Clear all data from test tables (in FK-safe order)
 */
export async function clearTestData(): Promise<void> {
  await pool.query('DELETE FROM chat_messages');
  await pool.query('DELETE FROM chat_sessions');
  await pool.query('DELETE FROM assets');
  await pool.query('DELETE FROM ydoc_states');
  await pool.query('DELETE FROM decks');
  await pool.query('DELETE FROM users');
}

/**
 * Setup hooks for Postgres-backed tests
 */
export function setupTestDatabase(): void {
  beforeAll(async () => {
    try {
      await pool.query('SELECT 1');
    } catch {
      console.warn('Postgres not available, tests will fail');
    }
    await initSchema();
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await clearTestData();
  });
}
