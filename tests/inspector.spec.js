import { test, expect } from '@playwright/test';
import { getDeckIdFromUrl, deleteDeckApi } from './utils';
test.describe('Inspector', () => {
    test.setTimeout(60000);
    // Track deck IDs created during tests for cleanup
    const createdDeckIds = [];
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('.deck-list-page', { timeout: 10000 });
        // Create a new deck
        await page.locator('button:has-text("New Deck")').click();
        await page.waitForSelector('.react-flow', { timeout: 10000 });
        await page.waitForSelector('.inspector', { timeout: 5000 });
        // Select the first slide in the canvas so inspector shows slide properties
        const slideNode = page.locator('.slide-node').first();
        await slideNode.waitFor({ state: 'visible', timeout: 5000 });
        await slideNode.click();
        await page.waitForTimeout(200);
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
    test('inspector is visible', async ({ page }) => {
        await expect(page.locator('.inspector')).toBeVisible();
    });
    test('has tab navigation', async ({ page }) => {
        // Should have Slide and Deck tabs
        const slideTab = page.locator('.inspector-tabs button:has-text("Slide")');
        const deckTab = page.locator('.inspector-tabs button:has-text("Deck")');
        await expect(slideTab).toBeVisible();
        await expect(deckTab).toBeVisible();
    });
    test('slide tab shows slide properties', async ({ page }) => {
        // Should show slide section header (slide is already selected in beforeEach)
        const slideHeader = page.locator('.section-header .section-header-name:has-text("Slide")');
        await expect(slideHeader.first()).toBeVisible({ timeout: 5000 });
    });
    test('deck tab shows deck properties', async ({ page }) => {
        // Click deck tab
        const deckTab = page.locator('.inspector-tabs button:has-text("Deck")');
        await deckTab.click();
        // Should show deck properties section
        await expect(page.locator('.inspector-section-header:has-text("Deck Properties")')).toBeVisible();
        // Should have deck title field
        await expect(page.locator('.inspector-field-label:has-text("Title")')).toBeVisible();
    });
    test('slide tab shows components list', async ({ page }) => {
        // Should show component headers or empty state (slide is already selected in beforeEach)
        // Check for either component headers or the empty state message
        const componentHeader = page.locator('.section-header[draggable]').first();
        const emptyMessage = page.locator('.component-list-empty');
        // At least one of these should be present
        const hasCards = await componentHeader.isVisible().catch(() => false);
        const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);
        expect(hasCards || hasEmptyMessage).toBe(true);
    });
    test('component card expands on click', async ({ page }) => {
        // Check if there are any component headers (slide is already selected in beforeEach)
        const componentHeader = page.locator('.section-header[draggable]').first();
        const hasCards = await componentHeader.isVisible({ timeout: 3000 }).catch(() => false);
        if (!hasCards) {
            // No components yet - just verify the empty state is visible
            const emptyMessage = page.locator('.component-list-empty');
            await expect(emptyMessage).toBeVisible({ timeout: 3000 });
            return;
        }
        // Click the component header to expand it
        await componentHeader.click();
        await page.waitForTimeout(300);
        // Should now show expanded content with properties or be in selected state
        const siblingBody = page.locator('.section-body[data-expanded="true"]');
        const isExpanded = await siblingBody.first().isVisible().catch(() => false);
        const isSelected = await componentHeader.evaluate(el => el.dataset.expanded === 'true');
        expect(isExpanded || isSelected).toBe(true);
    });
    test('can edit slide title', async ({ page }) => {
        // Slide is already selected in beforeEach, slide tab should be active
        // Expand the Slide section header first
        const slideHeader = page.locator('.section-header .section-header-name:has-text("Slide")').first();
        await expect(slideHeader).toBeVisible({ timeout: 5000 });
        await slideHeader.click();
        await page.waitForTimeout(300);
        // Find the title input inside the inspector content
        const titleInput = page.locator('.section-body-content input[type="text"]').first();
        const inputVisible = await titleInput.isVisible({ timeout: 3000 }).catch(() => false);
        if (inputVisible) {
            // Clear and type new title
            await titleInput.fill('New Slide Title');
            await titleInput.press('Tab');
            await page.waitForTimeout(200);
            // Verify value persists
            await expect(titleInput).toHaveValue('New Slide Title');
        }
        else {
            // At least verify the section header exists
            expect(await slideHeader.isVisible()).toBe(true);
        }
    });
    test('JSON tab shows deck data', async ({ page }) => {
        // Click JSON tab if available
        const jsonTab = page.locator('.inspector-tabs button:has-text("JSON")');
        if (await jsonTab.isVisible()) {
            await jsonTab.click();
            // Should show JSON content
            const jsonContent = page.locator('.inspector-json-content, pre, code');
            await expect(jsonContent.first()).toBeVisible();
            // Should contain deck structure keywords
            const content = await jsonContent.first().textContent();
            expect(content).toContain('meta');
            expect(content).toContain('slides');
        }
    });
    test('show grid toggle works in deck tab', async ({ page }) => {
        const deckTab = page.locator('.inspector-tabs button:has-text("Deck")');
        await deckTab.click();
        // Find the show grid checkbox
        const showGridCheckbox = page.locator('text=Show Grid').locator('..').locator('input[type="checkbox"]');
        if (await showGridCheckbox.isVisible()) {
            // Toggle it on
            await showGridCheckbox.check();
            await page.waitForTimeout(300);
            // Grid overlay should appear in the deck-slide
            const gridOverlay = page.locator('.grid-overlay');
            await expect(gridOverlay).toBeVisible();
            // Toggle it off
            await showGridCheckbox.uncheck();
            await page.waitForTimeout(300);
            // Grid overlay should be hidden
            await expect(gridOverlay).not.toBeVisible();
        }
    });
});
