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

  // Plain text rendering
  it('renders plain text content in a <p> tag', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', 'Hello World');
    document.body.appendChild(el);

    const p = el.shadowRoot?.querySelector('p');
    expect(p).not.toBeNull();
    expect(p?.textContent).toBe('Hello World');
  });

  it('escapes HTML in plain text mode', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', '<script>alert("xss")</script>');
    document.body.appendChild(el);

    const p = el.shadowRoot?.querySelector('p');
    expect(p?.innerHTML).not.toContain('<script>');
    expect(p?.textContent).toContain('<script>');
  });

  it('handles empty content', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', '');
    document.body.appendChild(el);

    const p = el.shadowRoot?.querySelector('p');
    expect(p?.textContent).toBe('');
  });

  // Markdown rendering
  it('renders markdown content in a <div> when markdown=true', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', '**Bold text**');
    el.setAttribute('markdown', 'true');
    document.body.appendChild(el);

    const div = el.shadowRoot?.querySelector('div.markdown');
    expect(div).not.toBeNull();
    const strong = div?.querySelector('strong');
    expect(strong?.textContent).toBe('Bold text');
  });

  it('renders markdown lists', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', '- Item 1\n- Item 2\n- Item 3');
    el.setAttribute('markdown', 'true');
    document.body.appendChild(el);

    const ul = el.shadowRoot?.querySelector('ul');
    expect(ul).not.toBeNull();
    const items = ul?.querySelectorAll('li');
    expect(items?.length).toBe(3);
  });

  it('renders markdown links', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', '[Click here](https://example.com)');
    el.setAttribute('markdown', 'true');
    document.body.appendChild(el);

    const a = el.shadowRoot?.querySelector('a');
    expect(a?.textContent).toBe('Click here');
    expect(a?.getAttribute('href')).toBe('https://example.com');
  });

  it('does NOT render markdown when markdown flag is absent', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', '**Not bold**');
    document.body.appendChild(el);

    // Should be plain text in a <p>, not rendered as markdown
    const p = el.shadowRoot?.querySelector('p');
    expect(p?.textContent).toBe('**Not bold**');
    expect(el.shadowRoot?.querySelector('strong')).toBeNull();
  });

  // Size
  it('applies size attribute to font-size', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'display'];
    for (const size of sizes) {
      const el = document.createElement('deck-text') as DeckText;
      el.setAttribute('content', 'test');
      el.setAttribute('size', size);
      document.body.appendChild(el);

      const style = el.shadowRoot?.querySelector('style');
      expect(style?.textContent).toContain('font-size:');
      document.body.innerHTML = '';
    }
  });

  it('uses display font family for display size', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', 'Display');
    el.setAttribute('size', 'display');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('--deck-font-display');
  });

  // Weight
  it('applies weight attribute', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', 'Bold');
    el.setAttribute('weight', 'bold');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('font-weight: 700');
  });

  // Align
  it('applies align attribute', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', 'Centered');
    el.setAttribute('align', 'center');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('text-align: center');
  });

  // Transform
  it('applies transform attribute', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', 'upper');
    el.setAttribute('transform', 'uppercase');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('text-transform: uppercase');
  });

  // Color
  it('applies color attribute', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', 'Red');
    el.setAttribute('color', '#ff0000');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('color: #ff0000');
  });

  // Observed attributes
  it('observes expected attributes', () => {
    expect(DeckText.observedAttributes).toContain('content');
    expect(DeckText.observedAttributes).toContain('markdown');
    expect(DeckText.observedAttributes).toContain('size');
    expect(DeckText.observedAttributes).toContain('weight');
    expect(DeckText.observedAttributes).toContain('align');
    expect(DeckText.observedAttributes).toContain('transform');
    expect(DeckText.observedAttributes).toContain('color');
    expect(DeckText.observedAttributes).toContain('grid-width');
  });

  // Dynamic updates
  it('updates when content attribute changes', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', 'Original');
    document.body.appendChild(el);

    expect(el.shadowRoot?.querySelector('p')?.textContent).toBe('Original');

    el.setAttribute('content', 'Updated');
    expect(el.shadowRoot?.querySelector('p')?.textContent).toBe('Updated');
  });

  it('switches between plain and markdown mode', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', '**Bold**');
    document.body.appendChild(el);

    // Plain mode — no strong tag
    expect(el.shadowRoot?.querySelector('p')).not.toBeNull();
    expect(el.shadowRoot?.querySelector('strong')).toBeNull();

    // Switch to markdown
    el.setAttribute('markdown', 'true');
    expect(el.shadowRoot?.querySelector('div.markdown')).not.toBeNull();
    expect(el.shadowRoot?.querySelector('strong')?.textContent).toBe('Bold');
  });

  it('renders inline math with KaTeX', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('markdown', 'true');
    el.setAttribute('content', 'Energy is $E=mc^2$ right?');
    document.body.appendChild(el);

    const katex = el.shadowRoot?.querySelector('.katex');
    expect(katex).not.toBeNull();
    // Should contain the math inline, not as a block
    expect(el.shadowRoot?.querySelector('.math-inline')).not.toBeNull();
  });

  it('renders block math with KaTeX', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('markdown', 'true');
    el.setAttribute('content', '$$\\sum_{i=1}^n x_i$$');
    document.body.appendChild(el);

    const katex = el.shadowRoot?.querySelector('.katex');
    expect(katex).not.toBeNull();
    expect(el.shadowRoot?.querySelector('.math-block')).not.toBeNull();
  });

  it('does not render math in plain text mode', () => {
    const el = document.createElement('deck-text') as DeckText;
    el.setAttribute('content', '$E=mc^2$');
    document.body.appendChild(el);

    expect(el.shadowRoot?.querySelector('.katex')).toBeNull();
  });
});
