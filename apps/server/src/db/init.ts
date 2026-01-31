/**
 * Initialize the database.
 * Run with: npm run db:init
 */

import { initSchema } from './schema.js';

initSchema();
console.log('[DB] Database initialized successfully');
