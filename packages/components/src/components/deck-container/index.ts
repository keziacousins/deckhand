/**
 * <deck-container> - Groups components in a sub-grid layout.
 * 
 * The container's gridWidth determines both how many parent columns it spans
 * AND how many internal columns are available for children, maintaining grid alignment.
 */

import { DeckComponent } from '../../base';
import type { ComponentMeta } from '../../types';
import { PropertyGroups, CommonProperties } from '../../types';
import { borderRadiusToCss, shadowToCss } from '../../utils/image-renderer';
import { styles } from './styles';

export class DeckContainer extends DeckComponent {
  static meta: ComponentMeta = {
    type: 'deck-container',
    name: 'Container',
    description: 'Groups components in a sub-grid. Children align to the container\'s internal grid.',
    category: 'layout',
    icon: 'layout-grid',
    properties: {
      gridWidth: {
        ...CommonProperties.gridWidth(),
        required: true,
        default: 6,
      },
      background: {
        type: 'color',
        label: 'Background',
        group: PropertyGroups.STYLE,
        compact: true,
      },
      padding: {
        type: 'enum',
        label: 'Padding',
        options: [
          { value: 'none', label: 'None' },
          { value: 'sm', label: 'Small' },
          { value: 'md', label: 'Medium' },
          { value: 'lg', label: 'Large' },
        ],
        default: 'none',
        group: PropertyGroups.STYLE,
        compact: true,
      },
      gap: {
        type: 'enum',
        label: 'Gap',
        options: [
          { value: '', label: 'Theme default' },
          { value: 'none', label: 'None' },
          { value: 'sm', label: 'Small' },
          { value: 'md', label: 'Medium' },
          { value: 'lg', label: 'Large' },
        ],
        group: PropertyGroups.STYLE,
        compact: true,
      },
      borderRadius: CommonProperties.borderRadius(),
      borderWidth: CommonProperties.borderWidth(),
      borderColor: CommonProperties.borderColor(),
      shadow: CommonProperties.shadow(),
      shadowColor: CommonProperties.shadowColor(),
      alignItems: {
        type: 'enum',
        label: 'Align Items',
        options: [
          { value: '', label: 'Default' },
          { value: 'start', label: 'Top' },
          { value: 'center', label: 'Center' },
          { value: 'end', label: 'Bottom' },
          { value: 'stretch', label: 'Stretch' },
        ],
        group: PropertyGroups.LAYOUT,
      },
      justifyContent: {
        type: 'enum',
        label: 'Justify Content',
        options: [
          { value: '', label: 'Default' },
          { value: 'start', label: 'Start' },
          { value: 'center', label: 'Center' },
          { value: 'end', label: 'End' },
          { value: 'space-between', label: 'Space Between' },
        ],
        group: PropertyGroups.LAYOUT,
      },
      // Floating mode properties
      anchorX: {
        type: 'enum',
        label: 'Anchor X',
        options: [
          { value: '', label: 'None (grid)' },
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ],
        group: PropertyGroups.ADVANCED,
        compact: true,
      },
      anchorY: {
        type: 'enum',
        label: 'Anchor Y',
        options: [
          { value: '', label: 'None (grid)' },
          { value: 'top', label: 'Top' },
          { value: 'bottom', label: 'Bottom' },
        ],
        group: PropertyGroups.ADVANCED,
        compact: true,
      },
      x: {
        type: 'string',
        label: 'X Offset',
        placeholder: '0',
        group: PropertyGroups.ADVANCED,
        compact: true,
      },
      y: {
        type: 'string',
        label: 'Y Offset',
        placeholder: '0',
        group: PropertyGroups.ADVANCED,
        compact: true,
      },
      width: {
        type: 'string',
        label: 'Width',
        placeholder: 'auto',
        group: PropertyGroups.ADVANCED,
        compact: true,
      },
      height: {
        type: 'string',
        label: 'Height',
        placeholder: 'auto',
        group: PropertyGroups.ADVANCED,
        compact: true,
      },
      opacity: {
        type: 'number',
        label: 'Opacity',
        min: 0,
        max: 100,
        step: 5,
        default: 100,
        group: PropertyGroups.ADVANCED,
        compact: true,
      },
    },
    preview: {
      sampleProps: {
        gridWidth: 6,
      },
    },
  };

  static observedAttributes = [
    'grid-width',
    'background',
    'padding',
    'gap',
    'border-radius',
    'border-width',
    'border-color',
    'shadow',
    'shadow-color',
    'align-items',
    'justify-content',
    // Floating mode
    'anchor-x',
    'anchor-y',
    'x',
    'y',
    'width',
    'height',
    'opacity',
    'linked',
  ];

  attributeChangedCallback(): void {
    this.render();
  }

  /**
   * Parse a dimension value — supports plain numbers ("20" → "20px"),
   * pixel values ("20px"), percentages ("5%"), or empty/auto → null.
   */
  private parseDimension(value: string | null): string | null {
    if (!value || value.trim() === '' || value === 'auto') return null;
    const trimmed = value.trim();
    if (trimmed.endsWith('px') || trimmed.endsWith('%')) return trimmed;
    const num = parseFloat(trimmed);
    return !isNaN(num) ? `${num}px` : null;
  }

  protected render(): void {
    const gridWidth = Math.floor(this.getAttrNumber('grid-width', 6));
    const background = this.getAttr('background', '');
    const padding = this.getAttr('padding', '');
    const gap = this.getAttr('gap', '');
    const borderRadius = this.getAttr('border-radius', '');
    const borderWidth = this.getAttrNumber('border-width', 0);
    const borderColor = this.getAttr('border-color', '');
    const shadow = this.getAttr('shadow', '');
    const shadowColor = this.getAttr('shadow-color', '');
    const alignItems = this.getAttr('align-items', '');
    const justifyContent = this.getAttr('justify-content', '');

    // Floating mode props
    const anchorX = this.getAttr('anchor-x', '');
    const anchorY = this.getAttr('anchor-y', '');
    const isFloating = !!(anchorX || anchorY);

    // Build dynamic styles
    const dynamicStyles: string[] = [];
    
    if (isFloating) {
      // Floating mode — absolute positioning
      dynamicStyles.push('position: absolute;');
      
      const x = this.parseDimension(this.getAttr('x', '0')) || '0px';
      const y = this.parseDimension(this.getAttr('y', '0')) || '0px';
      const width = this.parseDimension(this.getAttr('width'));
      const height = this.parseDimension(this.getAttr('height'));
      const opacity = this.getAttrNumber('opacity', 100);

      const xProp = anchorX === 'right' ? 'right' : 'left';
      const yProp = anchorY === 'bottom' ? 'bottom' : 'top';

      dynamicStyles.push(`${xProp}: ${x};`);
      dynamicStyles.push(`${yProp}: ${y};`);
      if (width) dynamicStyles.push(`width: ${width};`);
      if (height) dynamicStyles.push(`height: ${height};`);
      if (opacity < 100) dynamicStyles.push(`opacity: ${opacity / 100};`);
    }

    // Grid columns based on gridWidth (useful in both modes for child layout)
    dynamicStyles.push(`grid-template-columns: repeat(${gridWidth}, 1fr);`);
    
    if (background) {
      dynamicStyles.push(`background: ${background};`);
    }
    if (borderWidth > 0) {
      dynamicStyles.push(`border: ${borderWidth}px solid ${borderColor || '#000'};`);
    }
    // Box shadow
    const boxShadow = shadowToCss(shadow || undefined, shadowColor || undefined);
    if (boxShadow !== 'none') {
      dynamicStyles.push(`box-shadow: ${boxShadow};`);
    }
    if (alignItems) {
      dynamicStyles.push(`align-items: ${alignItems};`);
    }
    if (justifyContent) {
      dynamicStyles.push(`justify-content: ${justifyContent};`);
    }
    
    // Padding values
    const paddingValues: Record<string, string> = {
      'none': '0',
      'sm': '0.5rem',
      'md': '1rem',
      'lg': '1.5rem',
    };
    if (padding && paddingValues[padding]) {
      dynamicStyles.push(`padding: ${paddingValues[padding]};`);
    }
    
    // Gap values
    const gapValues: Record<string, string> = {
      'none': '0',
      'sm': '0.5rem',
      'md': '1rem',
      'lg': '1.5rem',
    };
    if (gap && gapValues[gap]) {
      dynamicStyles.push(`gap: ${gapValues[gap]};`);
    }
    
    // Border radius (shared helper with theme tokens)
    if (borderRadius && borderRadius !== 'none') {
      dynamicStyles.push(`border-radius: ${borderRadiusToCss(borderRadius)};`);
      dynamicStyles.push('overflow: hidden;');
    }

    this.shadow.innerHTML = `
      <style>
        ${this.getBaseStyles()}
        ${styles}
        :host {
          ${dynamicStyles.join('\n          ')}
        }
        ${this.getLinkedStyles()}
      </style>
      <slot></slot>
    `;
  }
}
