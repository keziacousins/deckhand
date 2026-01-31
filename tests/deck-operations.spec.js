import { test, expect } from '@playwright/test';
import { getDeckIdFromUrl, deleteDeckApi } from './utils';
test.describe('Deck Operations', () => {
    test.setTimeout(60000);
    // Track deck IDs created during tests for cleanup
    const createdDeckIds = [];
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('.deck-list-page', { timeout: 10000 });
    });
    test.afterEach(async ({ page }) => {
        // Clean up any deck created during this test
        const deckId = getDeckIdFromUrl(page);
        if (deckId) {
            createdDeckIds.push(deckId);
        }
    });
    test.afterAll(async () => {
        // Delete all decks created during tests
        for (const id of createdDeckIds) {
            await deleteDeckApi(id);
        }
        createdDeckIds.length = 0;
    });
    test('displays deck list page', async ({ page }) => {
        await expect(page.locator('.deck-list-page')).toBeVisible();
        await expect(page.locator('h1:has-text("Decks")')).toBeVisible();
    });
    test('creates new deck', async ({ page }) => {
        const createButton = page.locator('button:has-text("New Deck")');
        await expect(createButton).toBeVisible();
        await createButton.click();
        // Should navigate to editor with canvas
        await page.waitForSelector('.react-flow', { timeout: 10000 });
        await expect(page.locator('.react-flow')).toBeVisible();
        // Should have a slide node
        await expect(page.locator('.slide-node')).toBeVisible();
        // Should have inspector panel
        await expect(page.locator('.inspector')).toBeVisible();
    });
    test('new deck has default title component', async ({ page }) => {
        const createButton = page.locator('button:has-text("New Deck")');
        await createButton.click();
        await page.waitForSelector('.react-flow', { timeout: 10000 });
        await page.waitForSelector('deck-slide', { timeout: 5000 });
        // Should have a deck-title component
        const title = page.locator('deck-title');
        await expect(title).toBeVisible();
        // Should have default "Untitled Deck" text
        const text = await title.getAttribute('text');
        expect(text).toBe('Untitled Deck');
    });
    test('can navigate back to deck list', async ({ page }) => {
        // Create a deck first
        await page.locator('button:has-text("New Deck")').click();
        await page.waitForSelector('.react-flow', { timeout: 10000 });
        // Find back button or link
        const backLink = page.locator('a[href="/"]').first();
        if (await backLink.isVisible()) {
            await backLink.click();
            await page.waitForSelector('.deck-list-page', { timeout: 10000 });
            await expect(page.locator('.deck-list-page')).toBeVisible();
        }
    });
});
