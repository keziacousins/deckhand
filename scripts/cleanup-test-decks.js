"use strict";
/**
 * Cleanup script to delete test deck artifacts
 * Run with: npx tsx scripts/cleanup-test-decks.ts
 */
const API_BASE = 'http://localhost:3008/api';
async function main() {
    // Get all decks
    const response = await fetch(`${API_BASE}/decks`);
    if (!response.ok) {
        console.error('Failed to fetch decks. Is the server running?');
        process.exit(1);
    }
    const decks = await response.json();
    // Filter to "Untitled Deck" entries
    const testDecks = decks.filter(d => d.title.startsWith('Untitled Deck'));
    console.log(`Found ${testDecks.length} test decks to delete`);
    if (testDecks.length === 0) {
        console.log('Nothing to clean up');
        return;
    }
    // Delete each one
    let deleted = 0;
    let failed = 0;
    for (const deck of testDecks) {
        try {
            const res = await fetch(`${API_BASE}/decks/${deck.id}`, { method: 'DELETE' });
            if (res.ok || res.status === 404) {
                deleted++;
                process.stdout.write('.');
            }
            else {
                failed++;
                console.error(`\nFailed to delete ${deck.id}: ${res.status}`);
            }
        }
        catch (err) {
            failed++;
            console.error(`\nError deleting ${deck.id}:`, err);
        }
    }
    console.log(`\nDeleted ${deleted} decks, ${failed} failures`);
}
main().catch(console.error);
