/**
 * Server configuration and paths.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load .env file in development
if (process.env.NODE_ENV !== 'production') {
  const { config: dotenvConfig } = await import('dotenv');
  dotenvConfig();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Base data directory - can be overridden via environment
const DATA_ROOT = process.env.DATA_PATH || path.join(__dirname, '../deck-data');

// Directory structure
export const paths = {
  dataRoot: DATA_ROOT,
  db: path.join(DATA_ROOT, 'db'),
  dbFile: path.join(DATA_ROOT, 'db', 'deckhand.db'),
  decks: path.join(DATA_ROOT, 'decks'),

  // Get asset directory for a specific deck
  deckAssets: (deckId: string) => path.join(DATA_ROOT, 'decks', deckId, 'assets'),

  // Get full path to an asset file
  assetFile: (deckId: string, filename: string) =>
    path.join(DATA_ROOT, 'decks', deckId, 'assets', filename),
};

/**
 * Ensure all required directories exist.
 */
export function ensureDirectories(): void {
  const dirs = [paths.dataRoot, paths.db, paths.decks];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[Config] Created directory: ${dir}`);
    }
  }
}

/**
 * Ensure asset directory exists for a specific deck.
 */
export function ensureDeckAssetDir(deckId: string): string {
  const assetDir = paths.deckAssets(deckId);
  if (!fs.existsSync(assetDir)) {
    fs.mkdirSync(assetDir, { recursive: true });
  }
  return assetDir;
}

/**
 * Server configuration from environment variables.
 */
export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
};

/**
 * Check if LLM features are available.
 */
export function isLLMEnabled(): boolean {
  return !!config.anthropicApiKey;
}
