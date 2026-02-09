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

  it('applies border-radius values using theme tokens', () => {
    const testCases = [
      { value: 'sm', expected: 'var(--deck-radius-sm, 4px)' },
      { value: 'md', expected: 'var(--deck-radius-md, 8px)' },
      { value: 'lg', expected: 'var(--deck-radius-lg, 16px)' },
      { value: 'full', expected: '50%' },
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

  it('does not apply border-radius for none', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('border-radius', 'none');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    // The :host block should not contain border-radius when set to 'none'
    expect(style?.textContent).not.toContain('overflow: hidden');
  });

  it('applies structured border (borderWidth + borderColor)', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('border-width', '2');
    el.setAttribute('border-color', '#ff0000');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('border: 2px solid #ff0000');
  });

  it('applies shadow', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('shadow', 'md');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('box-shadow:');
  });

  it('applies shadow with custom color', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('shadow', 'lg');
    el.setAttribute('shadow-color', 'rgba(0,0,255,0.5)');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('box-shadow:');
    expect(style?.textContent).toContain('rgba(0,0,255,');
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
    expect(DeckContainer.observedAttributes).toContain('border-width');
    expect(DeckContainer.observedAttributes).toContain('border-color');
    expect(DeckContainer.observedAttributes).toContain('shadow');
    expect(DeckContainer.observedAttributes).toContain('shadow-color');
    expect(DeckContainer.observedAttributes).toContain('align-items');
    expect(DeckContainer.observedAttributes).toContain('justify-content');
    // Floating mode attributes
    expect(DeckContainer.observedAttributes).toContain('anchor-x');
    expect(DeckContainer.observedAttributes).toContain('anchor-y');
    expect(DeckContainer.observedAttributes).toContain('x');
    expect(DeckContainer.observedAttributes).toContain('y');
    expect(DeckContainer.observedAttributes).toContain('width');
    expect(DeckContainer.observedAttributes).toContain('height');
    expect(DeckContainer.observedAttributes).toContain('opacity');
  });

  // Floating mode tests
  it('applies absolute positioning when anchor-x is set', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('anchor-x', 'left');
    el.setAttribute('x', '20px');
    el.setAttribute('y', '10px');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('position: absolute');
    expect(style?.textContent).toContain('left: 20px');
    expect(style?.textContent).toContain('top: 10px');
  });

  it('applies right/bottom anchoring', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('anchor-x', 'right');
    el.setAttribute('anchor-y', 'bottom');
    el.setAttribute('x', '5%');
    el.setAttribute('y', '10%');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('position: absolute');
    expect(style?.textContent).toContain('right: 5%');
    expect(style?.textContent).toContain('bottom: 10%');
  });

  it('applies width and height in floating mode', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('anchor-x', 'left');
    el.setAttribute('width', '200px');
    el.setAttribute('height', '150px');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('width: 200px');
    expect(style?.textContent).toContain('height: 150px');
  });

  it('applies opacity in floating mode', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('anchor-x', 'left');
    el.setAttribute('opacity', '50');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('opacity: 0.5');
  });

  it('parses plain number dimensions as pixels', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('anchor-x', 'left');
    el.setAttribute('x', '30');
    el.setAttribute('width', '200');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('left: 30px');
    expect(style?.textContent).toContain('width: 200px');
  });

  it('does not apply absolute positioning in grid mode', () => {
    const el = document.createElement('deck-container') as DeckContainer;
    el.setAttribute('grid-width', '6');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).not.toContain('position: absolute');
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
