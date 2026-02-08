/**
 * <deck-container> - Groups components in a sub-grid layout.
 * 
 * The container's gridWidth determines both how many parent columns it spans
 * AND how many internal columns are available for children, maintaining grid alignment.
 */

import { DeckComponent } from '../../base';
import type { ComponentMeta } from '../../types';
import { PropertyGroups, CommonProperties } from '../../types';
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
      borderRadius: {
        type: 'enum',
        label: 'Radius',
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
      border: {
        type: 'string',
        label: 'Border',
        placeholder: 'e.g., 1px solid #ccc',
        group: PropertyGroups.STYLE,
      },
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
    'border',
    'align-items',
    'justify-content',
  ];

  attributeChangedCallback(): void {
    this.render();
  }

  protected render(): void {
    const gridWidth = Math.floor(this.getAttrNumber('grid-width', 6));
    const background = this.getAttr('background', '');
    const padding = this.getAttr('padding', '');
    const gap = this.getAttr('gap', '');
    const borderRadius = this.getAttr('border-radius', '');
    const border = this.getAttr('border', '');
    const alignItems = this.getAttr('align-items', '');
    const justifyContent = this.getAttr('justify-content', '');

    // Build dynamic styles - all styles applied inline to avoid attribute loops
    const dynamicStyles: string[] = [];
    
    // Grid columns based on gridWidth
    dynamicStyles.push(`grid-template-columns: repeat(${gridWidth}, 1fr);`);
    
    if (background) {
      dynamicStyles.push(`background: ${background};`);
    }
    if (border) {
      dynamicStyles.push(`border: ${border};`);
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
    
    // Border radius values
    const radiusValues: Record<string, string> = {
      'none': '0',
      'sm': '0.25rem',
      'md': '0.5rem',
      'lg': '1rem',
    };
    if (borderRadius && radiusValues[borderRadius]) {
      dynamicStyles.push(`border-radius: ${radiusValues[borderRadius]};`);
    }

    this.shadow.innerHTML = `
      <style>
        ${this.getBaseStyles()}
        ${styles}
        :host {
          ${dynamicStyles.join('\n          ')}
        }
      </style>
      <slot></slot>
    `;
  }
}
