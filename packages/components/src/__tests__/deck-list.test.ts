import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DeckList } from '../components/deck-list';

describe('DeckList', () => {
  beforeAll(() => {
    if (!customElements.get('deck-list')) {
      customElements.define('deck-list', DeckList);
    }
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('registers as a custom element', () => {
    expect(customElements.get('deck-list')).toBe(DeckList);
  });

  it('has correct meta information', () => {
    expect(DeckList.meta.type).toBe('deck-list');
    expect(DeckList.meta.name).toBe('List');
    expect(DeckList.meta.category).toBe('content');
  });

  it('creates element with shadow DOM', () => {
    const el = document.createElement('deck-list') as DeckList;
    document.body.appendChild(el);

    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot?.mode).toBe('open');
  });

  it('renders unordered list by default', () => {
    const el = document.createElement('deck-list') as DeckList;
    el.setAttribute('items', JSON.stringify(['Item 1', 'Item 2', 'Item 3']));
    document.body.appendChild(el);

    const ul = el.shadowRoot?.querySelector('ul');
    expect(ul).not.toBeNull();
    expect(el.shadowRoot?.querySelector('ol')).toBeNull();
  });

  it('renders ordered list when ordered attribute is set', () => {
    const el = document.createElement('deck-list') as DeckList;
    el.setAttribute('items', JSON.stringify(['First', 'Second', 'Third']));
    el.setAttribute('ordered', 'true');
    document.body.appendChild(el);

    const ol = el.shadowRoot?.querySelector('ol');
    expect(ol).not.toBeNull();
    expect(el.shadowRoot?.querySelector('ul')).toBeNull();
  });

  it('renders list items from JSON array', () => {
    const el = document.createElement('deck-list') as DeckList;
    el.setAttribute('items', JSON.stringify(['Apple', 'Banana', 'Cherry']));
    document.body.appendChild(el);

    const items = el.shadowRoot?.querySelectorAll('li');
    expect(items?.length).toBe(3);
    expect(items?.[0].textContent).toBe('Apple');
    expect(items?.[1].textContent).toBe('Banana');
    expect(items?.[2].textContent).toBe('Cherry');
  });

  it('parses newline-separated text as items', () => {
    const el = document.createElement('deck-list') as DeckList;
    el.setAttribute('items', 'Line 1\nLine 2\nLine 3');
    document.body.appendChild(el);

    const items = el.shadowRoot?.querySelectorAll('li');
    expect(items?.length).toBe(3);
    expect(items?.[0].textContent).toBe('Line 1');
    expect(items?.[1].textContent).toBe('Line 2');
    expect(items?.[2].textContent).toBe('Line 3');
  });

  it('filters empty lines when parsing newline-separated text', () => {
    const el = document.createElement('deck-list') as DeckList;
    el.setAttribute('items', 'Item 1\n\nItem 2\n  \nItem 3');
    document.body.appendChild(el);

    const items = el.shadowRoot?.querySelectorAll('li');
    expect(items?.length).toBe(3);
  });

  it('handles empty array', () => {
    const el = document.createElement('deck-list') as DeckList;
    el.setAttribute('items', '[]');
    document.body.appendChild(el);

    const items = el.shadowRoot?.querySelectorAll('li');
    expect(items?.length).toBe(0);
  });

  it('escapes HTML in items', () => {
    const el = document.createElement('deck-list') as DeckList;
    el.setAttribute('items', JSON.stringify(['<script>alert("xss")</script>']));
    document.body.appendChild(el);

    const li = el.shadowRoot?.querySelector('li');
    expect(li?.innerHTML).not.toContain('<script>');
    expect(li?.textContent).toContain('<script>');
  });

  it('observes expected attributes', () => {
    expect(DeckList.observedAttributes).toContain('items');
    expect(DeckList.observedAttributes).toContain('ordered');
  });

  it('updates when items attribute changes', () => {
    const el = document.createElement('deck-list') as DeckList;
    el.setAttribute('items', JSON.stringify(['Original']));
    document.body.appendChild(el);

    expect(el.shadowRoot?.querySelector('li')?.textContent).toBe('Original');

    el.setAttribute('items', JSON.stringify(['Updated']));
    expect(el.shadowRoot?.querySelector('li')?.textContent).toBe('Updated');
  });

  it('converts non-string items to strings', () => {
    const el = document.createElement('deck-list') as DeckList;
    el.setAttribute('items', JSON.stringify([1, 2, 3]));
    document.body.appendChild(el);

    const items = el.shadowRoot?.querySelectorAll('li');
    expect(items?.[0].textContent).toBe('1');
    expect(items?.[1].textContent).toBe('2');
    expect(items?.[2].textContent).toBe('3');
  });
});
