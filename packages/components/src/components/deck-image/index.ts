/**
 * <deck-image> - Image component for slides.
 * 
 * Displays an image from the deck's asset system.
 * Supports different fit modes, darkening, blur, and optional captions.
 */

import { DeckComponent } from '../../base';
import type { ComponentMeta } from '../../types';
import { PropertyGroups, CommonProperties } from '../../types';
import { styles } from './styles';
import { generateImageElementHtml, resolveAssetUrl } from '../../utils/image-renderer';

export class DeckImage extends DeckComponent {
  static meta: ComponentMeta = {
    type: 'deck-image',
    name: 'Image',
    description: 'Display an image with optional caption',
    category: 'content',
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
      caption: {
        type: 'string',
        label: 'Caption',
        placeholder: 'Optional caption text...',
        group: PropertyGroups.CONTENT,
      },
      fit: {
        type: 'enum',
        label: 'Fit',
        options: [
          { value: 'contain', label: 'Contain' },
          { value: 'cover', label: 'Cover' },
          { value: 'fill', label: 'Fill' },
        ],
        default: 'contain',
        group: PropertyGroups.STYLE,
        compact: true,
      },
      darken: {
        type: 'number',
        label: 'Darken',
        min: 0,
        max: 100,
        step: 5,
        default: 0,
        group: PropertyGroups.STYLE,
        compact: true,
      },
      blur: {
        type: 'number',
        label: 'Blur',
        min: 0,
        max: 20,
        step: 1,
        default: 0,
        group: PropertyGroups.STYLE,
        compact: true,
      },
      maxWidth: {
        type: 'number',
        label: 'Max Width',
        min: 0,
        max: 2000,
        step: 50,
        default: 0,
        group: PropertyGroups.LAYOUT,
        compact: true,
      },
      maxHeight: {
        type: 'number',
        label: 'Max Height',
        min: 0,
        max: 2000,
        step: 50,
        default: 0,
        group: PropertyGroups.LAYOUT,
        compact: true,
      },
      align: {
        type: 'enum',
        label: 'Align',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ],
        default: 'left',
        group: PropertyGroups.LAYOUT,
        compact: true,
      },
      color: {
        type: 'color',
        label: 'SVG Color',
        group: PropertyGroups.STYLE,
        compact: true,
      },
      borderRadius: CommonProperties.borderRadius(),
      borderWidth: CommonProperties.borderWidth(),
      borderColor: CommonProperties.borderColor(),
      shadow: CommonProperties.shadow(),
      shadowColor: CommonProperties.shadowColor(),
      gridWidth: {
        ...CommonProperties.gridWidth(),
        compact: true,
      },
    },
    preview: {
      sampleProps: {
        assetId: '',
        alt: 'Sample image',
        fit: 'contain',
      },
    },
  };

  static observedAttributes = ['asset-id', 'assets', 'alt', 'caption', 'fit', 'darken', 'blur', 'max-width', 'max-height', 'align', 'color', 'border-radius', 'border-width', 'border-color', 'shadow', 'shadow-color', 'grid-width', 'linked'];

  attributeChangedCallback(): void {
    this.render();
  }

  protected render(): void {
    const assetId = this.getAttr('asset-id');
    const assetsJson = this.getAttr('assets');
    const alt = this.getAttr('alt', '');
    const caption = this.getAttr('caption');
    const fit = this.getAttr('fit', 'contain');
    const darken = this.getAttrNumber('darken', 0);
    const blur = this.getAttrNumber('blur', 0);
    const maxWidth = this.getAttrNumber('max-width', 0);
    const maxHeight = this.getAttrNumber('max-height', 0);
    const align = this.getAttr('align', 'left') as 'left' | 'center' | 'right';
    const color = this.getAttr('color');
    const borderRadius = this.getAttr('border-radius', 'none') as 'none' | 'sm' | 'md' | 'lg' | 'full';
    const borderWidth = this.getAttrNumber('border-width', 0);
    const borderColor = this.getAttr('border-color');
    const shadow = this.getAttr('shadow', 'none') as 'none' | 'sm' | 'md' | 'lg';
    const shadowColor = this.getAttr('shadow-color');

    // Use shared image renderer
    const url = resolveAssetUrl(assetId, assetsJson);
    const { html: content, styles: imageStyles } = generateImageElementHtml({
      url,
      size: fit as 'contain' | 'cover' | 'fill',
      darken,
      blur,
      alt,
      caption: caption || undefined,
      maxWidth: maxWidth > 0 ? maxWidth : undefined,
      maxHeight: maxHeight > 0 ? maxHeight : undefined,
      align,
      color: color || undefined,
      borderRadius,
      borderWidth,
      borderColor: borderColor || undefined,
      shadow,
      shadowColor: shadowColor || undefined,
    });

    // Always include linked styles — they only activate when the linked attribute is present.
    // This avoids re-render timing issues since attributeChangedCallback may fire
    // after initial connectedCallback render.
    const linkedStyles = `
      :host([linked]) .image-wrapper {
        transition: box-shadow 200ms ease, transform 200ms ease;
      }
      :host([linked]:hover) .image-wrapper {
        box-shadow: 0 0 0 3px var(--deck-color-accent, #3b82f6),
                    0 0 12px 2px color-mix(in srgb, var(--deck-color-accent, #3b82f6) 40%, transparent) !important;
        transform: scale(1.02);
      }
    `;

    this.shadow.innerHTML = `
      <style>
        ${this.getBaseStyles()}
        ${styles}
        ${imageStyles}
        ${linkedStyles}
      </style>
      ${content}
    `;
  }
}
