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
    'padding',
    'background-color',
    'background-image',
    'grid-columns',
    'show-grid',
  ];

  attributeChangedCallback(): void {
    this.render();
  }

  protected render(): void {
    const gridColumns = this.getAttrNumber('grid-columns', 0);
    const gap = this.getAttr('gap', 'var(--deck-grid-gap, 16px)');
    const padding = this.getAttr('padding', 'var(--deck-space-xl)');
    const bgColor = this.getAttr('background-color', 'var(--deck-color-background)');
    const bgImage = this.getAttr('background-image');
    const showGrid = this.getAttrBool('show-grid');

    let layoutStyles: string;
    let gridOverlay = '';

    if (gridColumns > 0) {
      // Grid layout mode
      layoutStyles = `
        :host {
          display: grid;
          grid-template-columns: repeat(${gridColumns}, 1fr);
          grid-auto-rows: min-content;
          align-items: start;
          gap: ${gap};
          padding: ${padding};
          background-color: ${bgColor};
          ${bgImage ? `background-image: url(${bgImage}); background-size: cover; background-position: center;` : ''}
          position: relative;
        }
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
          display: flex;
          flex-direction: ${direction};
          align-items: ${alignItems};
          justify-content: ${justifyContent};
          gap: ${gap};
          padding: ${padding};
          background-color: ${bgColor};
          ${bgImage ? `background-image: url(${bgImage}); background-size: cover; background-position: center;` : ''}
        }
      `;
    }

    this.shadow.innerHTML = `
      <style>
        ${this.getBaseStyles()}
        ${styles}
        ${layoutStyles}
      </style>
      ${gridOverlay}
      <slot></slot>
    `;
  }
}
