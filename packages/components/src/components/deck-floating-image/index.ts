/**
 * <deck-floating-image> - Absolutely positioned image component.
 * 
 * Unlike deck-image which flows in the grid/flex layout, this component
 * is positioned at specific coordinates on the slide, outside the content
 * padding area.
 * 
 * Supports anchoring to any corner/edge via anchorX (left/right) and
 * anchorY (top/bottom) properties. Position values can be pixels or percentages.
 * 
 * Useful for logos, watermarks, decorative elements, or any image that
 * needs precise positioning outside the normal content flow.
 */

import { DeckComponent } from '../../base';
import type { ComponentMeta } from '../../types';
import { PropertyGroups } from '../../types';
import { styles } from './styles';
import { resolveAssetUrl, borderRadiusToCss } from '../../utils/image-renderer';

export class DeckFloatingImage extends DeckComponent {
  static meta: ComponentMeta = {
    type: 'deck-floating-image',
    name: 'Floating Image',
    description: 'Image positioned at specific coordinates on the slide',
    category: 'media',
    icon: 'image',
    properties: {
      assetId: {
        type: 'asset',
        label: 'Image',
        required: true,
        accept: ['image/*'],
        group: PropertyGroups.CONTENT,
      },
      alt: {
        type: 'string',
        label: 'Alt Text',
        description: 'Description for accessibility',
        placeholder: 'Describe the image...',
        group: PropertyGroups.CONTENT,
      },
      anchorX: {
        type: 'enum',
        label: 'Horizontal Anchor',
        description: 'Which horizontal edge to position from',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ],
        default: 'left',
        group: PropertyGroups.LAYOUT,
      },
      anchorY: {
        type: 'enum',
        label: 'Vertical Anchor',
        description: 'Which vertical edge to position from',
        options: [
          { value: 'top', label: 'Top' },
          { value: 'bottom', label: 'Bottom' },
        ],
        default: 'top',
        group: PropertyGroups.LAYOUT,
      },
      x: {
        type: 'string',
        label: 'X Offset',
        description: 'Horizontal offset (e.g., "20", "20px", "5%")',
        placeholder: '0',
        default: '0',
        group: PropertyGroups.LAYOUT,
      },
      y: {
        type: 'string',
        label: 'Y Offset',
        description: 'Vertical offset (e.g., "20", "20px", "5%")',
        placeholder: '0',
        default: '0',
        group: PropertyGroups.LAYOUT,
      },
      width: {
        type: 'string',
        label: 'Width',
        description: 'Width (e.g., "200", "200px", "25%", or empty for auto)',
        placeholder: 'auto',
        group: PropertyGroups.LAYOUT,
      },
      height: {
        type: 'string',
        label: 'Height',
        description: 'Height (e.g., "150", "150px", "20%", or empty for auto)',
        placeholder: 'auto',
        group: PropertyGroups.LAYOUT,
      },
      fit: {
        type: 'enum',
        label: 'Fit',
        description: 'How the image fills its container (when width & height are set)',
        options: [
          { value: 'contain', label: 'Contain (show all)' },
          { value: 'cover', label: 'Cover (fill, may crop)' },
          { value: 'fill', label: 'Fill (stretch)' },
        ],
        default: 'contain',
        group: PropertyGroups.STYLE,
      },
      opacity: {
        type: 'number',
        label: 'Opacity',
        description: 'Transparency (0 = invisible, 100 = fully visible)',
        min: 0,
        max: 100,
        step: 5,
        default: 100,
        group: PropertyGroups.STYLE,
      },
      borderRadius: {
        type: 'enum',
        label: 'Border Radius',
        description: 'Corner rounding',
        options: [
          { value: 'default', label: 'Default (theme)' },
          { value: 'none', label: 'None' },
          { value: 'sm', label: 'Small' },
          { value: 'md', label: 'Medium' },
          { value: 'lg', label: 'Large' },
          { value: 'full', label: 'Full (circle)' },
        ],
        default: 'default',
        group: PropertyGroups.STYLE,
      },
    },
    preview: {
      sampleProps: {
        assetId: '',
        alt: 'Floating image',
        anchorX: 'right',
        anchorY: 'bottom',
        x: '20',
        y: '20',
        width: '150',
        height: '',
      },
    },
  };

  static observedAttributes = [
    'asset-id',
    'assets',
    'alt',
    'anchor-x',
    'anchor-y',
    'x',
    'y',
    'width',
    'height',
    'fit',
    'opacity',
    'border-radius',
  ];

  attributeChangedCallback(): void {
    this.render();
  }

  /**
   * Parse a dimension value - supports:
   * - Plain numbers: "20" -> "20px"
   * - Pixel values: "20px" -> "20px"
   * - Percentages: "5%" -> "5%"
   * - Empty/auto: "" -> null
   */
  private parseDimension(value: string | null, defaultUnit = 'px'): string | null {
    if (!value || value.trim() === '' || value === 'auto') {
      return null;
    }
    const trimmed = value.trim();
    // Already has a unit
    if (trimmed.endsWith('px') || trimmed.endsWith('%')) {
      return trimmed;
    }
    // Plain number - add default unit
    const num = parseFloat(trimmed);
    if (!isNaN(num)) {
      return `${num}${defaultUnit}`;
    }
    return null;
  }

  protected render(): void {
    const assetId = this.getAttr('asset-id');
    const assetsJson = this.getAttr('assets');
    const alt = this.getAttr('alt', '');
    const anchorX = this.getAttr('anchor-x', 'left') as 'left' | 'right';
    const anchorY = this.getAttr('anchor-y', 'top') as 'top' | 'bottom';
    const x = this.parseDimension(this.getAttr('x', '0')) || '0px';
    const y = this.parseDimension(this.getAttr('y', '0')) || '0px';
    const width = this.parseDimension(this.getAttr('width'));
    const height = this.parseDimension(this.getAttr('height'));
    const fit = this.getAttr('fit', 'contain');
    const opacity = this.getAttrNumber('opacity', 100);
    const borderRadiusAttr = this.getAttr('border-radius', 'default') as 'default' | 'none' | 'sm' | 'md' | 'lg' | 'full';
    const borderRadius = borderRadiusToCss(borderRadiusAttr);

    const url = resolveAssetUrl(assetId, assetsJson);

    // Determine object-fit based on fit mode
    const objectFit = fit === 'contain' ? 'contain' : fit === 'cover' ? 'cover' : 'fill';

    // Build positioning styles based on anchors
    const xProp = anchorX === 'left' ? 'left' : 'right';
    const yProp = anchorY === 'top' ? 'top' : 'bottom';

    const positionStyles = `
      :host {
        ${xProp}: ${x};
        ${yProp}: ${y};
        ${width ? `width: ${width};` : ''}
        ${height ? `height: ${height};` : ''}
        opacity: ${opacity / 100};
      }
      .floating-image {
        display: block;
        ${width && height ? `
          width: 100%;
          height: 100%;
          object-fit: ${objectFit};
        ` : `
          max-width: 100%;
          height: auto;
        `}
        border-radius: ${borderRadius};
      }
      .placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${width || '150px'};
        height: ${height || '100px'};
        background: var(--deck-color-surface, #f1f5f9);
        border: 2px dashed var(--deck-color-border, #cbd5e1);
        border-radius: ${borderRadius};
        color: var(--deck-color-text-secondary, #64748b);
        font-family: var(--deck-font-body, system-ui, sans-serif);
        font-size: 12px;
      }
    `;

    const escapedAlt = alt.replace(/[&<>"']/g, (c) => {
      const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return entities[c] || c;
    });

    const content = url
      ? `<img class="floating-image" src="${url}" alt="${escapedAlt}" loading="lazy" />`
      : `<div class="placeholder">No image</div>`;

    this.shadow.innerHTML = `
      <style>
        ${this.getBaseStyles()}
        ${styles}
        ${positionStyles}
      </style>
      ${content}
    `;
  }
}
