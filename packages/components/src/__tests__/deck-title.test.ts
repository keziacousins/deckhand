import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DeckTitle } from '../components/deck-title';

describe('DeckTitle', () => {
  beforeAll(() => {
    // Register the custom element if not already registered
    if (!customElements.get('deck-title')) {
      customElements.define('deck-title', DeckTitle);
    }
  });

  beforeEach(() => {
    // Clear document body before each test
    document.body.innerHTML = '';
  });

  it('registers as a custom element', () => {
    expect(customElements.get('deck-title')).toBe(DeckTitle);
  });

  it('has correct meta information', () => {
    expect(DeckTitle.meta.type).toBe('deck-title');
    expect(DeckTitle.meta.name).toBe('Title');
    expect(DeckTitle.meta.category).toBe('content');
  });

  it('creates element with shadow DOM', () => {
    const el = document.createElement('deck-title') as DeckTitle;
    document.body.appendChild(el);
    
    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot?.mode).toBe('open');
  });

  it('renders text attribute', () => {
    const el = document.createElement('deck-title') as DeckTitle;
    el.setAttribute('text', 'Hello World');
    document.body.appendChild(el);
    
    const heading = el.shadowRoot?.querySelector('h1, h2, h3');
    expect(heading?.textContent).toBe('Hello World');
  });

  it('defaults to h1 when no level specified', () => {
    const el = document.createElement('deck-title') as DeckTitle;
    el.setAttribute('text', 'Title');
    document.body.appendChild(el);
    
    const h1 = el.shadowRoot?.querySelector('h1');
    expect(h1).not.toBeNull();
  });

  it('uses level attribute to set heading element', () => {
    const el1 = document.createElement('deck-title') as DeckTitle;
    el1.setAttribute('text', 'Level 1');
    el1.setAttribute('level', '1');
    document.body.appendChild(el1);
    expect(el1.shadowRoot?.querySelector('h1')).not.toBeNull();
    
    const el2 = document.createElement('deck-title') as DeckTitle;
    el2.setAttribute('text', 'Level 2');
    el2.setAttribute('level', '2');
    document.body.appendChild(el2);
    expect(el2.shadowRoot?.querySelector('h2')).not.toBeNull();
    
    const el3 = document.createElement('deck-title') as DeckTitle;
    el3.setAttribute('text', 'Level 3');
    el3.setAttribute('level', '3');
    document.body.appendChild(el3);
    expect(el3.shadowRoot?.querySelector('h3')).not.toBeNull();
  });

  it('applies align attribute', () => {
    const el = document.createElement('deck-title') as DeckTitle;
    el.setAttribute('text', 'Centered');
    el.setAttribute('align', 'center');
    document.body.appendChild(el);
    
    // Check that the style includes text-align
    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('text-align: center');
  });

  it('passes through grid-width attribute', () => {
    const el = document.createElement('deck-title') as DeckTitle;
    el.setAttribute('text', 'Grid');
    el.setAttribute('grid-width', '6');
    document.body.appendChild(el);
    
    expect(el.getAttribute('grid-width')).toBe('6');
  });

  it('updates when text attribute changes', () => {
    const el = document.createElement('deck-title') as DeckTitle;
    el.setAttribute('text', 'Original');
    document.body.appendChild(el);
    
    expect(el.shadowRoot?.querySelector('h1')?.textContent).toBe('Original');
    
    el.setAttribute('text', 'Updated');
    expect(el.shadowRoot?.querySelector('h1')?.textContent).toBe('Updated');
  });

  it('observes expected attributes', () => {
    expect(DeckTitle.observedAttributes).toContain('text');
    expect(DeckTitle.observedAttributes).toContain('level');
    expect(DeckTitle.observedAttributes).toContain('align');
  });

  it('contains base styles', () => {
    const el = document.createElement('deck-title') as DeckTitle;
    el.setAttribute('text', 'Styled');
    document.body.appendChild(el);
    
    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain(':host');
    expect(style?.textContent).toContain('font-family');
  });

  it('uses CSS custom properties for theming', () => {
    const el = document.createElement('deck-title') as DeckTitle;
    el.setAttribute('text', 'Themed');
    document.body.appendChild(el);
    
    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('var(--deck-');
  });
});
