/**
 * <deck-slide> - Container component for a slide.
 * 
 * Applies theme tokens and layout configuration.
 * This is a special "container" component - it wraps other components
 * and is not directly selectable in the component picker.
 * 
 * Supports two layout modes:
 * 1. Flex (default): Components stack vertically or horizontally
 * 2. Grid: Components flow into a CSS grid with configurable columns
 */

import { DeckComponent } from '../../base';
import type { ComponentMeta } from '../../types';
import { styles } from './styles';
import { generateImageBackgroundHtml, resolveAssetUrl, sizeToCss } from '../../utils/image-renderer';

export class DeckSlide extends DeckComponent {
  static meta: ComponentMeta = {
    type: 'deck-slide',
    name: 'Slide',
    description: 'Container for slide content. Applies theme and layout.',
    category: 'layout',
    properties: {},
  };

  static observedAttributes = [
    'align-items',
    'justify-content',
    'direction',
    'gap',
    'background-color',
    'background-asset-id',
    'assets',
    'background-size',
    'background-darken',
    'background-blur',
    'grid-columns',
    'show-grid',
    // Style overrides (theme token overrides per slide)
    'style-background',
    'style-text-primary',
    'style-text-secondary',
    'style-accent',
  ];

  attributeChangedCallback(): void {
    this.render();
  }

  protected render(): void {
    const gridColumns = this.getAttrNumber('grid-columns', 0);
    const gap = this.getAttr('gap', 'var(--deck-grid-gap, 16px)');
    // Content padding from theme tokens - top/bottom and left/right
    const paddingTop = 'var(--deck-content-padding-top, 48px)';
    const paddingSides = 'var(--deck-content-padding-sides, 64px)';
    const padding = `${paddingTop} ${paddingSides}`;
    
    // Background image using shared renderer
    const bgAssetId = this.getAttr('background-asset-id');
    const assetsJson = this.getAttr('assets');
    const bgSizeAttr = this.getAttr('background-size', 'fill');
    const bgDarken = this.getAttrNumber('background-darken', 0);
    const bgBlur = this.getAttrNumber('background-blur', 0);
    const showGrid = this.getAttrBool('show-grid');
    
    // Use shared image renderer
    const bgUrl = resolveAssetUrl(bgAssetId, assetsJson);
    const { html: bgImageElement, styles: bgImageStyles } = generateImageBackgroundHtml({
      url: bgUrl,
      size: bgSizeAttr as 'fill' | 'fit-width' | 'fit-height',
      darken: bgDarken,
      blur: bgBlur,
    });

    // Style overrides - these override theme tokens for this slide
    const styleBackground = this.getAttr('style-background');
    const styleTextPrimary = this.getAttr('style-text-primary');
    const styleTextSecondary = this.getAttr('style-text-secondary');
    const styleAccent = this.getAttr('style-accent');

    // Build CSS custom property overrides
    const tokenOverrides: string[] = [];
    if (styleBackground) tokenOverrides.push(`--deck-color-background: ${styleBackground}`);
    if (styleTextPrimary) tokenOverrides.push(`--deck-color-text-primary: ${styleTextPrimary}`);
    if (styleTextSecondary) tokenOverrides.push(`--deck-color-text-secondary: ${styleTextSecondary}`);
    if (styleAccent) tokenOverrides.push(`--deck-color-accent: ${styleAccent}`);
    
    // Use style override background or fall back to theme token
    const bgColor = styleBackground || 'var(--deck-color-background)';

    let layoutStyles: string;
    let gridOverlay = '';

    // Token overrides CSS (injected into :host)
    const tokenOverridesCSS = tokenOverrides.length > 0 ? tokenOverrides.join(';\n          ') + ';' : '';

    if (gridColumns > 0) {
      // Grid layout mode
      layoutStyles = `
        :host {
          ${tokenOverridesCSS}
          display: grid;
          grid-template-columns: repeat(${gridColumns}, 1fr);
          grid-auto-rows: min-content;
          align-items: start;
          gap: ${gap};
          padding: ${padding};
          background-color: ${bgColor};
          position: relative;
        }
        ${bgImageStyles}
        .grid-overlay {
          position: absolute;
          inset: 0;
          padding: ${padding};
          display: grid;
          grid-template-columns: repeat(${gridColumns}, 1fr);
          gap: ${gap};
          pointer-events: none;
          z-index: 1000;
        }
        .grid-overlay-col {
          background: rgba(59, 130, 246, 0.1);
          border: 1px dashed rgba(59, 130, 246, 0.3);
          border-radius: 2px;
        }
        ::slotted(*) {
          position: relative;
          z-index: 1;
        }
      `;

      if (showGrid) {
        const cols = Array.from({ length: gridColumns }, (_, i) => 
          `<div class="grid-overlay-col" data-col="${i + 1}"></div>`
        ).join('');
        gridOverlay = `<div class="grid-overlay">${cols}</div>`;
      }
    } else {
      // Flex layout mode (original behavior)
      const alignItems = this.getAttr('align-items', 'start');
      const justifyContent = this.getAttr('justify-content', 'start');
      const direction = this.getAttr('direction', 'column');

      layoutStyles = `
        :host {
          ${tokenOverridesCSS}
          display: flex;
          flex-direction: ${direction};
          align-items: ${alignItems};
          justify-content: ${justifyContent};
          gap: ${gap};
          padding: ${padding};
          background-color: ${bgColor};
          position: relative;
        }
        ${bgImageStyles}
        ::slotted(*) {
          position: relative;
          z-index: 1;
        }
      `;
    }

    this.shadow.innerHTML = `
      <style>
        ${this.getBaseStyles()}
        ${styles}
        ${layoutStyles}
      </style>
      ${bgImageElement}
      ${gridOverlay}
      <slot></slot>
    `;
  }
}
