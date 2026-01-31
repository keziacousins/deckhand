/**
 * Shared test utilities for E2E tests
 */
import { Page } from '@playwright/test';
/**
 * Get the current deck ID from the URL hash
 */
export declare function getDeckIdFromUrl(page: Page): string | null;
/**
 * Delete a deck via the API
 */
export declare function deleteDeckApi(deckId: string): Promise<boolean>;
/**
 * Get all decks via the API
 */
export declare function listDecksApi(): Promise<Array<{
    id: string;
    title: string;
}>>;
/**
 * Delete all decks matching a title pattern (for test cleanup)
 */
export declare function deleteDecksMatching(titlePattern: RegExp): Promise<number>;
/**
 * Delete all "Untitled Deck" entries (common test artifacts)
 */
export declare function cleanupTestDecks(): Promise<number>;
//# sourceMappingURL=utils.d.ts.map