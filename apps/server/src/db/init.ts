/**
 * Initialize the database.
 * Run with: npm run db:init
 */

import { initSchema, pool } from './schema.js';

await initSchema();
console.log('[DB] Database initialized successfully');
await pool.end();
