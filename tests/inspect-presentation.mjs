import { chromium } from 'playwright';

const DECK_ID = 'deck-558af72b';
const BASE = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto(`${BASE}/#/deck/${DECK_ID}/present`);
  await page.waitForSelector('deck-slide', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Get DOM structure
  const structure = await page.evaluate(() => {
    const viewport = document.querySelector('.presentation-viewport');
    if (!viewport) return 'No .presentation-viewport found';
    
    function desc(el, depth = 0) {
      if (depth > 6) return '...';
      const indent = '  '.repeat(depth);
      const tag = el.tagName?.toLowerCase() || '?';
      const cls = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
      const linked = el.hasAttribute?.('linked') ? ' [linked]' : '';
      const dlc = el.getAttribute?.('data-linked-component-id');
      const dlcStr = dlc ? ` [dlcid=${dlc}]` : '';
      
      let line = `${indent}<${tag}${cls}${linked}${dlcStr}>`;
      
      if (el.shadowRoot) {
        line += ' (shadow)';
        const result = [line];
        for (const child of el.shadowRoot.children) {
          if (child.tagName === 'STYLE') {
            const t = child.textContent || '';
            const hasLinked = t.includes(':host([linked]');
            const hasWrapperHover = t.includes(':host([linked]:hover) .image-wrapper');
            result.push(`${indent}  <style linked=${hasLinked} wrapperHover=${hasWrapperHover}>`);
          } else {
            result.push(desc(child, depth + 1));
          }
        }
        return result.join('\n');
      }
      
      if (el.children.length === 0) return line;
      const result = [line];
      for (const child of el.children) {
        result.push(desc(child, depth + 1));
      }
      return result.join('\n');
    }
    
    return desc(viewport);
  });
  
  console.log('=== DOM STRUCTURE ===');
  console.log(structure);
  
  // Get deck-image details
  const imageInfo = await page.evaluate(() => {
    const images = document.querySelectorAll('deck-image');
    return Array.from(images).map(img => {
      const hs = window.getComputedStyle(img);
      const info = {
        linked: img.hasAttribute('linked'),
        dlcid: img.getAttribute('data-linked-component-id'),
        host_cursor: hs.cursor,
        host_boxShadow: hs.boxShadow,
        host_borderRadius: hs.borderRadius,
      };
      
      if (img.shadowRoot) {
        const w = img.shadowRoot.querySelector('.image-wrapper');
        if (w) {
          const ws = window.getComputedStyle(w);
          info.wrapper_boxShadow = ws.boxShadow;
          info.wrapper_borderRadius = ws.borderRadius;
          info.wrapper_transition = ws.transition;
        }
        const style = img.shadowRoot.querySelector('style');
        if (style) {
          info.hasLinkedSelector = style.textContent?.includes(':host([linked]') ?? false;
          info.hasWrapperHover = style.textContent?.includes(':host([linked]:hover) .image-wrapper') ?? false;
        }
      }
      
      return info;
    });
  });
  
  console.log('\n=== DECK-IMAGE DETAILS ===');
  console.log(JSON.stringify(imageInfo, null, 2));
  
  await browser.close();
})();
