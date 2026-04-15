import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      // Use separate test database to avoid clobbering dev data
      DATABASE_URL: process.env.DATABASE_URL?.replace('/deckhand', '/deckhand_test') || '',
    },
  },
});
