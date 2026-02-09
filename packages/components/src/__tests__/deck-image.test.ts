import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { DeckImage } from '../components/deck-image';

describe('DeckImage', () => {
  beforeAll(() => {
    if (!customElements.get('deck-image')) {
      customElements.define('deck-image', DeckImage);
    }
  });

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('registers as a custom element', () => {
    expect(customElements.get('deck-image')).toBe(DeckImage);
  });

  it('has correct meta information', () => {
    expect(DeckImage.meta.type).toBe('deck-image');
    expect(DeckImage.meta.name).toBe('Image');
    expect(DeckImage.meta.category).toBe('content');
  });

  it('creates element with shadow DOM', () => {
    const el = document.createElement('deck-image') as DeckImage;
    document.body.appendChild(el);

    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot?.mode).toBe('open');
  });

  it('renders image from asset URL', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'img-123');
    el.setAttribute('assets', JSON.stringify({ 'img-123': { url: '/images/test.png' } }));
    document.body.appendChild(el);

    const img = el.shadowRoot?.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/images/test.png');
  });

  it('renders placeholder when no asset URL', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'missing');
    document.body.appendChild(el);

    const placeholder = el.shadowRoot?.querySelector('.image-placeholder');
    expect(placeholder).not.toBeNull();
  });

  it('applies alt text', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'img-123');
    el.setAttribute('assets', JSON.stringify({ 'img-123': { url: '/test.png' } }));
    el.setAttribute('alt', 'Test image description');
    document.body.appendChild(el);

    const img = el.shadowRoot?.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('Test image description');
  });

  it('renders caption when provided', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'img-123');
    el.setAttribute('assets', JSON.stringify({ 'img-123': { url: '/test.png' } }));
    el.setAttribute('caption', 'This is a caption');
    document.body.appendChild(el);

    const caption = el.shadowRoot?.querySelector('.image-caption, figcaption');
    expect(caption?.textContent).toContain('This is a caption');
  });

  it('applies fit attribute', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'img-123');
    el.setAttribute('assets', JSON.stringify({ 'img-123': { url: '/test.png' } }));
    el.setAttribute('fit', 'cover');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('object-fit: cover');
  });

  it('applies darken overlay', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'img-123');
    el.setAttribute('assets', JSON.stringify({ 'img-123': { url: '/test.png' } }));
    el.setAttribute('darken', '50');
    document.body.appendChild(el);

    const overlay = el.shadowRoot?.querySelector('.image-overlay');
    expect(overlay).not.toBeNull();
  });

  it('applies blur effect', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'img-123');
    el.setAttribute('assets', JSON.stringify({ 'img-123': { url: '/test.png' } }));
    el.setAttribute('blur', '5');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('blur(5px)');
  });

  it('applies max-width constraint', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'img-123');
    el.setAttribute('assets', JSON.stringify({ 'img-123': { url: '/test.png' } }));
    el.setAttribute('max-width', '500');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('max-width: 500px');
  });

  it('applies max-height constraint', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'img-123');
    el.setAttribute('assets', JSON.stringify({ 'img-123': { url: '/test.png' } }));
    el.setAttribute('max-height', '300');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    // The renderer uses height for the wrapper container
    expect(style?.textContent).toContain('height: 300px');
  });

  it('applies align attribute', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'img-123');
    el.setAttribute('assets', JSON.stringify({ 'img-123': { url: '/test.png' } }));
    el.setAttribute('align', 'center');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('center');
  });

  it('applies border-radius attribute', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'img-123');
    el.setAttribute('assets', JSON.stringify({ 'img-123': { url: '/test.png' } }));
    el.setAttribute('border-radius', 'full');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('50%');
  });

  it('applies border-width and border-color', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'img-123');
    el.setAttribute('assets', JSON.stringify({ 'img-123': { url: '/test.png' } }));
    el.setAttribute('border-width', '3');
    el.setAttribute('border-color', '#ff0000');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('border: 3px solid #ff0000');
  });

  it('applies shadow attribute', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'img-123');
    el.setAttribute('assets', JSON.stringify({ 'img-123': { url: '/test.png' } }));
    el.setAttribute('shadow', 'md');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('box-shadow:');
  });

  it('applies shadow with custom color', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('asset-id', 'img-123');
    el.setAttribute('assets', JSON.stringify({ 'img-123': { url: '/test.png' } }));
    el.setAttribute('shadow', 'lg');
    el.setAttribute('shadow-color', 'rgba(255,0,0,0.5)');
    document.body.appendChild(el);

    const style = el.shadowRoot?.querySelector('style');
    expect(style?.textContent).toContain('box-shadow:');
    expect(style?.textContent).toContain('rgba(255,0,0,');
  });

  it('observes expected attributes', () => {
    expect(DeckImage.observedAttributes).toContain('asset-id');
    expect(DeckImage.observedAttributes).toContain('assets');
    expect(DeckImage.observedAttributes).toContain('alt');
    expect(DeckImage.observedAttributes).toContain('fit');
    expect(DeckImage.observedAttributes).toContain('darken');
    expect(DeckImage.observedAttributes).toContain('blur');
    expect(DeckImage.observedAttributes).toContain('border-width');
    expect(DeckImage.observedAttributes).toContain('border-color');
    expect(DeckImage.observedAttributes).toContain('shadow');
    expect(DeckImage.observedAttributes).toContain('shadow-color');
  });

  it('updates when asset-id attribute changes', () => {
    const el = document.createElement('deck-image') as DeckImage;
    el.setAttribute('assets', JSON.stringify({
      'img-1': { url: '/image1.png' },
      'img-2': { url: '/image2.png' },
    }));
    el.setAttribute('asset-id', 'img-1');
    document.body.appendChild(el);

    expect(el.shadowRoot?.querySelector('img')?.getAttribute('src')).toBe('/image1.png');

    el.setAttribute('asset-id', 'img-2');
    expect(el.shadowRoot?.querySelector('img')?.getAttribute('src')).toBe('/image2.png');
  });
});
