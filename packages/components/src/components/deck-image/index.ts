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
      caption: {
        type: 'string',
        label: 'Caption',
        placeholder: 'Optional caption text...',
        group: PropertyGroups.CONTENT,
      },
      fit: {
        type: 'enum',
        label: 'Fit',
        description: 'How the image fills its container',
        options: [
          { value: 'contain', label: 'Contain (show all)' },
          { value: 'cover', label: 'Cover (fill, may crop)' },
          { value: 'fill', label: 'Fill (stretch)' },
        ],
        default: 'contain',
        group: PropertyGroups.STYLE,
      },
      darken: {
        type: 'number',
        label: 'Darken',
        description: 'Darken overlay percentage',
        min: 0,
        max: 100,
        step: 5,
        default: 0,
        group: PropertyGroups.STYLE,
      },
      blur: {
        type: 'number',
        label: 'Blur',
        description: 'Blur amount in pixels',
        min: 0,
        max: 20,
        step: 1,
        default: 0,
        group: PropertyGroups.STYLE,
      },
      maxWidth: {
        type: 'number',
        label: 'Max Width',
        description: 'Maximum width in pixels (0 = no limit)',
        min: 0,
        max: 2000,
        step: 50,
        default: 0,
        group: PropertyGroups.LAYOUT,
      },
      maxHeight: {
        type: 'number',
        label: 'Max Height',
        description: 'Maximum height in pixels (0 = no limit)',
        min: 0,
        max: 2000,
        step: 50,
        default: 0,
        group: PropertyGroups.LAYOUT,
      },
      align: {
        type: 'enum',
        label: 'Align',
        description: 'Horizontal alignment within grid slot',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ],
        default: 'left',
        group: PropertyGroups.LAYOUT,
      },
      color: {
        type: 'color',
        label: 'SVG Color',
        description: 'Fill color for SVGs using currentColor',
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
      gridWidth: CommonProperties.gridWidth(),
    },
    preview: {
      sampleProps: {
        assetId: '',
        alt: 'Sample image',
        fit: 'contain',
      },
    },
  };

  static observedAttributes = ['asset-id', 'assets', 'alt', 'caption', 'fit', 'darken', 'blur', 'max-width', 'max-height', 'align', 'color', 'border-radius', 'grid-width'];

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
    const borderRadius = this.getAttr('border-radius', 'default') as 'default' | 'none' | 'sm' | 'md' | 'lg' | 'full';

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
    });

    this.shadow.innerHTML = `
      <style>
        ${this.getBaseStyles()}
        ${styles}
        ${imageStyles}
      </style>
      ${content}
    `;
  }
}
