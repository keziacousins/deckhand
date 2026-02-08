/**
 * Shared test utilities for E2E tests
 */
const API_BASE = 'http://localhost:3008/api';
/**
 * Get the current deck ID from the URL hash
 */
export function getDeckIdFromUrl(page) {
    const url = page.url();
    const match = url.match(/#\/deck\/(.+)$/);
    return match ? match[1] : null;
}
/**
 * Delete a deck via the API
 */
export async function deleteDeckApi(deckId) {
    try {
        const response = await fetch(`${API_BASE}/decks/${deckId}`, {
            method: 'DELETE',
        });
        return response.ok || response.status === 404;
    }
    catch {
        return false;
    }
}
/**
 * Get all decks via the API
 */
export async function listDecksApi() {
    try {
        const response = await fetch(`${API_BASE}/decks`);
        if (!response.ok)
            return [];
        return response.json();
    }
    catch {
        return [];
    }
}
/**
 * Delete all decks matching a title pattern (for test cleanup)
 */
export async function deleteDecksMatching(titlePattern) {
    const decks = await listDecksApi();
    let deleted = 0;
    for (const deck of decks) {
        if (titlePattern.test(deck.title)) {
            if (await deleteDeckApi(deck.id)) {
                deleted++;
            }
        }
    }
    return deleted;
}
/**
 * Delete all "Untitled Deck" entries (common test artifacts)
 */
export async function cleanupTestDecks() {
    return deleteDecksMatching(/^Untitled Deck/);
}
