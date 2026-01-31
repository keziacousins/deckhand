import { test, expect } from '@playwright/test';
import { getDeckIdFromUrl, deleteDeckApi } from './utils';
test.describe('Canvas', () => {
    test.setTimeout(60000);
    // Track deck IDs created during tests for cleanup
    const createdDeckIds = [];
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('.deck-list-page', { timeout: 10000 });
        // Create a new deck
        await page.locator('button:has-text("New Deck")').click();
        await page.waitForSelector('.react-flow', { timeout: 10000 });
    });
    test.afterEach(async ({ page }) => {
        const deckId = getDeckIdFromUrl(page);
        if (deckId) {
            createdDeckIds.push(deckId);
        }
    });
    test.afterAll(async () => {
        for (const id of createdDeckIds) {
            await deleteDeckApi(id);
        }
        createdDeckIds.length = 0;
    });
    test('canvas is visible', async ({ page }) => {
        await expect(page.locator('.react-flow')).toBeVisible();
    });
    test('has at least one slide node', async ({ page }) => {
        const slideNodes = page.locator('.slide-node');
        await expect(slideNodes.first()).toBeVisible();
    });
    test('slide node contains deck-slide component', async ({ page }) => {
        const deckSlide = page.locator('deck-slide');
        await expect(deckSlide.first()).toBeVisible();
    });
    test('slide node can be selected', async ({ page }) => {
        const slideNode = page.locator('.slide-node').first();
        await slideNode.click();
        // Should have selected class
        await expect(slideNode).toHaveClass(/selected/);
    });
    test('slide contains web components', async ({ page }) => {
        await page.waitForSelector('deck-slide', { timeout: 5000 });
        // Should have deck-title inside
        const deckTitle = page.locator('deck-title');
        await expect(deckTitle.first()).toBeVisible();
    });
    test('web components have shadow DOM', async ({ page }) => {
        await page.waitForSelector('deck-title', { timeout: 5000 });
        const hasShadowRoot = await page.locator('deck-title').first().evaluate((el) => {
            return el.shadowRoot !== null;
        });
        expect(hasShadowRoot).toBe(true);
    });
    test('deck-slide respects grid-columns attribute', async ({ page }) => {
        await page.waitForSelector('deck-slide', { timeout: 5000 });
        const deckSlide = page.locator('deck-slide').first();
        const gridColumns = await deckSlide.getAttribute('grid-columns');
        // Should have grid-columns attribute set
        expect(gridColumns).toBeDefined();
        expect(parseInt(gridColumns || '0')).toBeGreaterThan(0);
    });
    test('deck-slide uses CSS grid when grid-columns is set', async ({ page }) => {
        await page.waitForSelector('deck-slide', { timeout: 5000 });
        const deckSlide = page.locator('deck-slide').first();
        const display = await deckSlide.evaluate((el) => {
            return window.getComputedStyle(el).display;
        });
        expect(display).toBe('grid');
    });
    test('clicking component updates inspector state', async ({ page }) => {
        await page.waitForSelector('deck-title', { timeout: 5000 });
        // Click on the deck-title component
        const deckTitle = page.locator('deck-title').first();
        await deckTitle.click();
        await page.waitForTimeout(500);
        // Should have component cards in inspector
        const componentCards = page.locator('.component-card');
        await expect(componentCards.first()).toBeVisible();
    });
});
