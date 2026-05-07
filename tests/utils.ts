import type { Page } from '@playwright/test';

const API_BASE = process.env.PLAYWRIGHT_API_BASE ?? 'http://localhost:3008/api';

/** Extract the deck ID from the editor URL (hash-based: /#/deck/<id>). */
export function getDeckIdFromUrl(page: Page): string | null {
  const url = page.url();
  const match = url.match(/#\/deck\/([\w-]+)/);
  return match ? match[1] : null;
}

/** Delete a deck via the API (used in test cleanup). */
export async function deleteDeckApi(deckId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/decks/${deckId}`, { method: 'DELETE' });
  } catch {
    // Ignore — best-effort cleanup
  }
}
