import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DeckText } from '../components/deck-text';

describe('DeckText', () => {
  beforeAll(() => {
    if (!customElements.get('deck-text')) {
      customElements.define('deck-text', DeckText);
    }
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('registers as a custom element', () => {
    expect(customElements.get('deck-text')).toBe(DeckText);
  });

  it('has correct meta information', () => {
    expect(DeckText.meta.type).toBe('deck-text');
    expect(DeckText.meta.name).toBe('Text');
    expect(DeckText.meta.category).toBe('content');
  });

  it('creates element with shadow DOM', () => {
    const el = document.createElement('deck-text') as DeckText;
    document.body.appendChild(el);

    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot?.mode).toBe('open');
  });

  it('renders plain text content', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', JSON.stringify([{ text: 'Hello World' }]));
    document.body.appendChild(el);

    const p = el.shadowRoot?.querySelector('p');
    expect(p?.textContent).toBe('Hello World');
  });

  it('renders bold text', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', JSON.stringify([{ text: 'Bold', bold: true }]));
    document.body.appendChild(el);

    const strong = el.shadowRoot?.querySelector('strong');
    expect(strong?.textContent).toBe('Bold');
  });

  it('renders italic text', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', JSON.stringify([{ text: 'Italic', italic: true }]));
    document.body.appendChild(el);

    const em = el.shadowRoot?.querySelector('em');
    expect(em?.textContent).toBe('Italic');
  });

  it('renders underlined text', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', JSON.stringify([{ text: 'Underline', underline: true }]));
    document.body.appendChild(el);

    const u = el.shadowRoot?.querySelector('u');
    expect(u?.textContent).toBe('Underline');
  });

  it('renders code text', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', JSON.stringify([{ text: 'code', code: true }]));
    document.body.appendChild(el);

    const code = el.shadowRoot?.querySelector('code');
    expect(code?.textContent).toBe('code');
  });

  it('renders links', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', JSON.stringify([{ text: 'Click me', href: 'https://example.com' }]));
    document.body.appendChild(el);

    const a = el.shadowRoot?.querySelector('a');
    expect(a?.textContent).toBe('Click me');
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.getAttribute('target')).toBe('_blank');
  });

  it('renders multiple spans', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', JSON.stringify([
      { text: 'Normal ' },
      { text: 'bold', bold: true },
      { text: ' and ' },
      { text: 'italic', italic: true },
    ]));
    document.body.appendChild(el);

    const p = el.shadowRoot?.querySelector('p');
    expect(p?.innerHTML).toContain('Normal');
    expect(p?.querySelector('strong')?.textContent).toBe('bold');
    expect(p?.querySelector('em')?.textContent).toBe('italic');
  });

  it('handles combined formatting', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', JSON.stringify([{ text: 'Bold Italic', bold: true, italic: true }]));
    document.body.appendChild(el);

    const p = el.shadowRoot?.querySelector('p');
    const strong = p?.querySelector('strong');
    const em = strong?.querySelector('em') || p?.querySelector('em');
    expect(em).not.toBeNull();
  });

  it('applies align attribute', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', JSON.stringify([{ text: 'Centered' }]));
    el.setAttribute('align', 'center');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('text-align: center');
  });

  it('handles invalid JSON as plain text', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', 'Just plain text');
    document.body.appendChild(el);

    const p = el.shadowRoot?.querySelector('p');
    expect(p?.textContent).toBe('Just plain text');
  });

  it('handles empty content', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', '[]');
    document.body.appendChild(el);

    const p = el.shadowRoot?.querySelector('p');
    expect(p?.textContent).toBe('');
  });

  it('escapes HTML in text', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', JSON.stringify([{ text: '<script>alert("xss")</script>' }]));
    document.body.appendChild(el);

    const p = el.shadowRoot?.querySelector('p');
    expect(p?.innerHTML).not.toContain('<script>');
    expect(p?.textContent).toContain('<script>');
  });

  it('observes expected attributes', () => {
    expect(DeckText.observedAttributes).toContain('content');
    expect(DeckText.observedAttributes).toContain('align');
  });

  it('updates when content attribute changes', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', JSON.stringify([{ text: 'Original' }]));
    document.body.appendChild(el);

    expect(el.shadowRoot?.querySelector('p')?.textContent).toBe('Original');

    el.setAttribute('content', JSON.stringify([{ text: 'Updated' }]));
    expect(el.shadowRoot?.querySelector('p')?.textContent).toBe('Updated');
  });
});
