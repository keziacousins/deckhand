import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DeckHeadlineSubhead } from '../components/deck-headline-subhead';

describe('DeckHeadlineSubhead', () => {
  beforeAll(() => {
    if (!customElements.get('deck-headline-subhead')) {
      customElements.define('deck-headline-subhead', DeckHeadlineSubhead);
    }
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('registers as a custom element', () => {
    expect(customElements.get('deck-headline-subhead')).toBe(DeckHeadlineSubhead);
  });

  it('has correct meta information', () => {
    expect(DeckHeadlineSubhead.meta.type).toBe('deck-headline-subhead');
    expect(DeckHeadlineSubhead.meta.name).toBe('Headline + Subhead');
    expect(DeckHeadlineSubhead.meta.category).toBe('content');
  });

  it('creates element with shadow DOM', () => {
    const el = document.createElement('deck-headline-subhead') as DeckHeadlineSubhead;
    document.body.appendChild(el);
    
    expect(el.shadowRoot).not.toBeNull();
  });

  it('renders headline attribute', () => {
    const el = document.createElement('deck-headline-subhead') as DeckHeadlineSubhead;
    el.setAttribute('headline', 'Big News');
    document.body.appendChild(el);
    
    const headline = el.shadowRoot?.querySelector('.headline');
    expect(headline?.textContent).toBe('Big News');
  });

  it('renders subheading attribute', () => {
    const el = document.createElement('deck-headline-subhead') as DeckHeadlineSubhead;
    el.setAttribute('headline', 'Title');
    el.setAttribute('subheading', 'More details here');
    document.body.appendChild(el);
    
    const subheading = el.shadowRoot?.querySelector('.subheading');
    expect(subheading?.textContent).toBe('More details here');
  });

  it('renders category attribute', () => {
    const el = document.createElement('deck-headline-subhead') as DeckHeadlineSubhead;
    el.setAttribute('headline', 'Title');
    el.setAttribute('category', 'Announcement');
    document.body.appendChild(el);
    
    const category = el.shadowRoot?.querySelector('.category');
    expect(category?.textContent).toBe('Announcement');
  });

  it('hides subheading when not provided', () => {
    const el = document.createElement('deck-headline-subhead') as DeckHeadlineSubhead;
    el.setAttribute('headline', 'Just Headline');
    document.body.appendChild(el);
    
    const subheading = el.shadowRoot?.querySelector('.subheading');
    // Either null or empty
    expect(!subheading || subheading.textContent === '').toBe(true);
  });

  it('hides category when not provided', () => {
    const el = document.createElement('deck-headline-subhead') as DeckHeadlineSubhead;
    el.setAttribute('headline', 'No Category');
    document.body.appendChild(el);
    
    const category = el.shadowRoot?.querySelector('.category');
    expect(!category || category.textContent === '').toBe(true);
  });

  it('applies is-hero attribute for hero styling', () => {
    const el = document.createElement('deck-headline-subhead') as DeckHeadlineSubhead;
    el.setAttribute('headline', 'Hero Title');
    el.setAttribute('is-hero', 'true');
    document.body.appendChild(el);
    
    const style = el.shadowRoot?.querySelector('style');
    // Hero should have larger font size
    expect(style?.textContent).toContain('font-size');
  });

  it('applies variant attribute', () => {
    const elDark = document.createElement('deck-headline-subhead') as DeckHeadlineSubhead;
    elDark.setAttribute('headline', 'Dark');
    elDark.setAttribute('variant', 'dark');
    document.body.appendChild(elDark);
    
    const elLight = document.createElement('deck-headline-subhead') as DeckHeadlineSubhead;
    elLight.setAttribute('headline', 'Light');
    elLight.setAttribute('variant', 'light');
    document.body.appendChild(elLight);
    
    // Both should render without error
    expect(elDark.shadowRoot?.querySelector('.headline')).not.toBeNull();
    expect(elLight.shadowRoot?.querySelector('.headline')).not.toBeNull();
  });

  it('applies align attribute', () => {
    const el = document.createElement('deck-headline-subhead') as DeckHeadlineSubhead;
    el.setAttribute('headline', 'Centered');
    el.setAttribute('align', 'center');
    document.body.appendChild(el);
    
    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('text-align: center');
  });

  it('observes expected attributes', () => {
    expect(DeckHeadlineSubhead.observedAttributes).toContain('headline');
    expect(DeckHeadlineSubhead.observedAttributes).toContain('subheading');
    expect(DeckHeadlineSubhead.observedAttributes).toContain('category');
    expect(DeckHeadlineSubhead.observedAttributes).toContain('is-hero');
    expect(DeckHeadlineSubhead.observedAttributes).toContain('variant');
    expect(DeckHeadlineSubhead.observedAttributes).toContain('align');
  });

  it('updates when headline changes', () => {
    const el = document.createElement('deck-headline-subhead') as DeckHeadlineSubhead;
    el.setAttribute('headline', 'Original');
    document.body.appendChild(el);
    
    expect(el.shadowRoot?.querySelector('.headline')?.textContent).toBe('Original');
    
    el.setAttribute('headline', 'Changed');
    expect(el.shadowRoot?.querySelector('.headline')?.textContent).toBe('Changed');
  });

  it('uses CSS custom properties for theming', () => {
    const el = document.createElement('deck-headline-subhead') as DeckHeadlineSubhead;
    el.setAttribute('headline', 'Themed');
    document.body.appendChild(el);
    
    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('var(--deck-');
  });
});
