import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DeckSlide } from '../components/deck-slide';

describe('DeckSlide', () => {
  beforeAll(() => {
    if (!customElements.get('deck-slide')) {
      customElements.define('deck-slide', DeckSlide);
    }
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('registers as a custom element', () => {
    expect(customElements.get('deck-slide')).toBe(DeckSlide);
  });

  it('has correct meta information', () => {
    expect(DeckSlide.meta.type).toBe('deck-slide');
    expect(DeckSlide.meta.name).toBe('Slide');
    expect(DeckSlide.meta.category).toBe('layout');
  });

  it('creates element with shadow DOM', () => {
    const el = document.createElement('deck-slide') as DeckSlide;
    document.body.appendChild(el);
    
    expect(el.shadowRoot).not.toBeNull();
  });

  it('renders a slot for content', () => {
    const el = document.createElement('deck-slide') as DeckSlide;
    document.body.appendChild(el);
    
    const slot = el.shadowRoot?.querySelector('slot');
    expect(slot).not.toBeNull();
  });

  it('uses flex layout by default (grid-columns=0)', () => {
    const el = document.createElement('deck-slide') as DeckSlide;
    document.body.appendChild(el);
    
    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('display: flex');
  });

  it('uses grid layout when grid-columns is set', () => {
    const el = document.createElement('deck-slide') as DeckSlide;
    el.setAttribute('grid-columns', '8');
    document.body.appendChild(el);
    
    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('display: grid');
    expect(style?.textContent).toContain('grid-template-columns: repeat(8, 1fr)');
  });

  it('shows grid overlay when show-grid is set', () => {
    const el = document.createElement('deck-slide') as DeckSlide;
    el.setAttribute('grid-columns', '8');
    el.setAttribute('show-grid', 'true');
    document.body.appendChild(el);
    
    const overlay = el.shadowRoot?.querySelector('.grid-overlay');
    expect(overlay).not.toBeNull();
    
    const cols = el.shadowRoot?.querySelectorAll('.grid-overlay-col');
    expect(cols?.length).toBe(8);
  });

  it('does not show grid overlay by default', () => {
    const el = document.createElement('deck-slide') as DeckSlide;
    el.setAttribute('grid-columns', '8');
    document.body.appendChild(el);
    
    const overlay = el.shadowRoot?.querySelector('.grid-overlay');
    expect(overlay).toBeNull();
  });

  it('applies background-color attribute', () => {
    const el = document.createElement('deck-slide') as DeckSlide;
    el.setAttribute('background-color', '#ff0000');
    document.body.appendChild(el);
    
    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('background-color: #ff0000');
  });

  it('applies gap attribute', () => {
    const el = document.createElement('deck-slide') as DeckSlide;
    el.setAttribute('gap', '24px');
    document.body.appendChild(el);
    
    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('gap: 24px');
  });

  it('applies padding attribute', () => {
    const el = document.createElement('deck-slide') as DeckSlide;
    el.setAttribute('padding', '32px');
    document.body.appendChild(el);
    
    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('padding: 32px');
  });

  it('observes expected attributes', () => {
    expect(DeckSlide.observedAttributes).toContain('grid-columns');
    expect(DeckSlide.observedAttributes).toContain('show-grid');
    expect(DeckSlide.observedAttributes).toContain('background-color');
    expect(DeckSlide.observedAttributes).toContain('gap');
    expect(DeckSlide.observedAttributes).toContain('padding');
  });

  it('re-renders when attributes change', () => {
    const el = document.createElement('deck-slide') as DeckSlide;
    document.body.appendChild(el);
    
    // Initially flex
    let style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('display: flex');
    
    // Change to grid
    el.setAttribute('grid-columns', '6');
    style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('display: grid');
    expect(style?.textContent).toContain('repeat(6, 1fr)');
  });

  it('includes grid-width slotted styles', () => {
    const el = document.createElement('deck-slide') as DeckSlide;
    el.setAttribute('grid-columns', '8');
    document.body.appendChild(el);
    
    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('::slotted([grid-width=');
    expect(style?.textContent).toContain('grid-column: span');
  });

  it('sets default slotted elements to full width', () => {
    const el = document.createElement('deck-slide') as DeckSlide;
    el.setAttribute('grid-columns', '8');
    document.body.appendChild(el);
    
    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('::slotted(:not([grid-width]))');
    expect(style?.textContent).toContain('grid-column: 1 / -1');
  });
});
