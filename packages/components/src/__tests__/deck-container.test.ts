import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DeckContainer } from '../components/deck-container';

describe('DeckContainer', () => {
  beforeAll(() => {
    if (!customElements.get('deck-container')) {
      customElements.define('deck-container', DeckContainer);
    }
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('registers as a custom element', () => {
    expect(customElements.get('deck-container')).toBe(DeckContainer);
  });

  it('has correct meta information', () => {
    expect(DeckContainer.meta.type).toBe('deck-container');
    expect(DeckContainer.meta.name).toBe('Container');
    expect(DeckContainer.meta.category).toBe('layout');
  });

  it('creates element with shadow DOM', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    document.body.appendChild(el);

    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot?.mode).toBe('open');
  });

  it('contains a slot for child elements', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    document.body.appendChild(el);

    const slot = el.shadowRoot?.querySelector('slot');
    expect(slot).not.toBeNull();
  });

  it('sets grid columns based on grid-width attribute', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('grid-width', '4');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('grid-template-columns: repeat(4, 1fr)');
  });

  it('defaults to 6 columns', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('grid-template-columns: repeat(6, 1fr)');
  });

  it('applies background color', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('background', '#ff0000');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('background: #ff0000');
  });

  it('applies padding values', () => {
    const testCases = [
      { value: 'sm', expected: '0.5rem' },
      { value: 'md', expected: '1rem' },
      { value: 'lg', expected: '1.5rem' },
      { value: 'none', expected: '0' },
    ];

    for (const { value, expected } of testCases) {
      const el = document.createElement('deck-container') as DeckContainer;
      el.setAttribute('padding', value);
      document.body.appendChild(el);

      const style = el.shadowRoot?.querySelector('style');
      expect(style?.textContent).toContain(`padding: ${expected}`);
      document.body.innerHTML = '';
    }
  });

  it('applies gap values', () => {
    const testCases = [
      { value: 'sm', expected: '0.5rem' },
      { value: 'md', expected: '1rem' },
      { value: 'lg', expected: '1.5rem' },
      { value: 'none', expected: '0' },
    ];

    for (const { value, expected } of testCases) {
      const el = document.createElement('deck-container') as DeckContainer;
      el.setAttribute('gap', value);
      document.body.appendChild(el);

      const style = el.shadowRoot?.querySelector('style');
      expect(style?.textContent).toContain(`gap: ${expected}`);
      document.body.innerHTML = '';
    }
  });

  it('applies border-radius values', () => {
    const testCases = [
      { value: 'sm', expected: '0.25rem' },
      { value: 'md', expected: '0.5rem' },
      { value: 'lg', expected: '1rem' },
      { value: 'none', expected: '0' },
    ];

    for (const { value, expected } of testCases) {
      const el = document.createElement('deck-container') as DeckContainer;
      el.setAttribute('border-radius', value);
      document.body.appendChild(el);

      const style = el.shadowRoot?.querySelector('style');
      expect(style?.textContent).toContain(`border-radius: ${expected}`);
      document.body.innerHTML = '';
    }
  });

  it('applies border style', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('border', '1px solid #ccc');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('border: 1px solid #ccc');
  });

  it('applies align-items', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('align-items', 'center');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('align-items: center');
  });

  it('applies justify-content', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('justify-content', 'space-between');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('justify-content: space-between');
  });

  it('observes expected attributes', () => {
    expect(DeckContainer.observedAttributes).toContain('grid-width');
    expect(DeckContainer.observedAttributes).toContain('background');
    expect(DeckContainer.observedAttributes).toContain('padding');
    expect(DeckContainer.observedAttributes).toContain('gap');
    expect(DeckContainer.observedAttributes).toContain('border-radius');
    expect(DeckContainer.observedAttributes).toContain('border');
    expect(DeckContainer.observedAttributes).toContain('align-items');
    expect(DeckContainer.observedAttributes).toContain('justify-content');
  });

  it('updates when grid-width attribute changes', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('grid-width', '4');
    document.body.appendChild(el);

    expect(el.shadowRoot?.querySelector('style')?.textContent).toContain('repeat(4, 1fr)');

    el.setAttribute('grid-width', '8');
    expect(el.shadowRoot?.querySelector('style')?.textContent).toContain('repeat(8, 1fr)');
  });

  it('floors non-integer grid-width values', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('grid-width', '4.7');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('repeat(4, 1fr)');
  });
});
