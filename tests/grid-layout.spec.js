import { test, expect } from '@playwright/test';
import { getDeckIdFromUrl, deleteDeckApi } from './utils';
test.describe('Grid Layout', () => {
    test.setTimeout(60000);
    // Track deck IDs created during tests for cleanup
    const createdDeckIds = [];
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
    test('inspect deck-slide and component structure', async ({ page }) => {
        // Navigate to the app
        await page.goto('/');
        // Wait for the deck list page to load
        await page.waitForSelector('.deck-list-page', { timeout: 10000 });
        // Try to find or create a deck
        const createButton = page.locator('button:has-text("New Deck")');
        if (await createButton.isVisible()) {
            await createButton.click();
            await page.waitForTimeout(2000);
        }
        // Wait for the canvas to appear
        await page.waitForSelector('.react-flow', { timeout: 10000 });
        // Find the deck-slide element
        const deckSlide = page.locator('deck-slide').first();
        await expect(deckSlide).toBeVisible({ timeout: 5000 });
        // Log the deck-slide attributes
        const gridColumns = await deckSlide.getAttribute('grid-columns');
        console.log('=== DECK-SLIDE INSPECTION ===');
        console.log('grid-columns attribute:', gridColumns);
        // Get the computed style of the host element
        const hostStyles = await deckSlide.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return {
                display: styles.display,
                gridTemplateColumns: styles.gridTemplateColumns,
                gap: styles.gap,
            };
        });
        console.log('Host computed styles:', JSON.stringify(hostStyles, null, 2));
        // Check shadow DOM structure
        const shadowInfo = await deckSlide.evaluate((el) => {
            const shadow = el.shadowRoot;
            if (!shadow)
                return { error: 'No shadow root' };
            const style = shadow.querySelector('style');
            const styleText = style?.textContent || '';
            // Extract just the :host rules
            const hostRuleMatch = styleText.match(/:host\s*\{[^}]+\}/g);
            return {
                hasSlot: !!shadow.querySelector('slot'),
                hostRules: hostRuleMatch || [],
                fullStyleLength: styleText.length,
            };
        });
        console.log('Shadow DOM info:', JSON.stringify(shadowInfo, null, 2));
        // Find child components (they're in light DOM, slotted into shadow DOM)
        const components = page.locator('deck-slide > *');
        const count = await components.count();
        console.log('\n=== CHILD COMPONENTS ===');
        console.log('Number of children:', count);
        for (let i = 0; i < count; i++) {
            const comp = components.nth(i);
            const info = await comp.evaluate((el) => {
                const styles = window.getComputedStyle(el);
                return {
                    tagName: el.tagName.toLowerCase(),
                    gridWidth: el.getAttribute('grid-width'),
                    allAttributes: Array.from(el.attributes).map(a => `${a.name}="${a.value}"`).join(' '),
                    computedStyles: {
                        display: styles.display,
                        gridColumn: styles.gridColumn,
                        gridColumnStart: styles.gridColumnStart,
                        gridColumnEnd: styles.gridColumnEnd,
                    }
                };
            });
            console.log(`\nComponent ${i}:`, JSON.stringify(info, null, 2));
        }
    });
    test('debug existing deck with gridWidth set', async ({ page }) => {
        // This test opens an existing deck (if available) and inspects the DOM
        await page.goto('/');
        await page.waitForSelector('.deck-list-page', { timeout: 10000 });
        // Click on the first existing deck if available
        const deckCard = page.locator('.deck-card').first();
        const hasDeck = await deckCard.isVisible().catch(() => false);
        if (hasDeck) {
            await deckCard.click();
            await page.waitForTimeout(2000);
        }
        else {
            console.log('No existing decks found, skipping test');
            return;
        }
        await page.waitForSelector('.react-flow', { timeout: 10000 });
        await page.waitForSelector('deck-slide', { timeout: 5000 });
        // Get all deck-title components
        const titles = page.locator('deck-title');
        const count = await titles.count();
        console.log(`\n=== Found ${count} deck-title components ===\n`);
        for (let i = 0; i < count; i++) {
            const title = titles.nth(i);
            const info = await title.evaluate((el) => {
                const styles = window.getComputedStyle(el);
                return {
                    text: el.getAttribute('text'),
                    gridWidthAttr: el.getAttribute('grid-width'),
                    computedGridColumn: styles.gridColumn,
                    computedDisplay: styles.display,
                    boundingRect: el.getBoundingClientRect(),
                };
            });
            console.log(`Title ${i}:`, JSON.stringify(info, null, 2));
        }
        // Also check the deck-slide
        const slide = page.locator('deck-slide').first();
        const slideInfo = await slide.evaluate((el) => {
            const styles = window.getComputedStyle(el);
            return {
                gridColumnsAttr: el.getAttribute('grid-columns'),
                computedDisplay: styles.display,
                computedGridTemplateColumns: styles.gridTemplateColumns,
            };
        });
        console.log('\nDeck-slide:', JSON.stringify(slideInfo, null, 2));
    });
    test('set gridWidth and verify attribute updates', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('.deck-list-page', { timeout: 10000 });
        // Create a new deck
        const createButton = page.locator('button:has-text("New Deck")');
        await createButton.click();
        await page.waitForTimeout(2000);
        // Wait for canvas and slide
        await page.waitForSelector('.react-flow', { timeout: 10000 });
        await page.waitForSelector('deck-slide', { timeout: 5000 });
        // Click on the component card in the inspector to expand it
        // First, click on the slide node to make sure it's selected
        const slideNode = page.locator('.slide-node').first();
        await slideNode.click();
        await page.waitForTimeout(500);
        // Now click on the component card header in the inspector
        const componentCard = page.locator('.component-card-header').first();
        await componentCard.click();
        await page.waitForTimeout(500);
        // Now look for Grid Width
        const gridWidthLabel = page.locator('text=Grid Width').first();
        const isVisible = await gridWidthLabel.isVisible().catch(() => false);
        console.log('Grid Width label visible after expanding card:', isVisible);
        // Log the full inspector content
        const inspectorContent = await page.locator('.inspector-content').innerHTML();
        console.log('Inspector HTML structure (truncated):', inspectorContent.substring(0, 1500));
        if (isVisible) {
            // Find the input in the same field group
            const input = page.locator('.inspector-field-label:has-text("Grid Width")').locator('..').locator('input');
            const currentValue = await input.inputValue();
            console.log('Current Grid Width value:', currentValue);
            await input.fill('4');
            await input.press('Tab'); // Trigger blur/change
            await page.waitForTimeout(500);
            // Now check the attribute on the component
            const title = page.locator('deck-title').first();
            const gridWidthAttr = await title.getAttribute('grid-width');
            console.log('After setting, grid-width attribute:', gridWidthAttr);
            const computedGridColumn = await title.evaluate((el) => {
                return window.getComputedStyle(el).gridColumn;
            });
            console.log('Computed gridColumn:', computedGridColumn);
        }
        else {
            console.log('Grid Width still not found');
        }
    });
});
