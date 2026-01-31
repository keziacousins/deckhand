/**
 * <deck-headline-subhead> - Headline with optional category and subheading.
 * 
 * A flexible headline component supporting hero and normal modes with
 * light/dark variants. Adapted from Finco's _generic-headline-subhead.njk.
 * 
 * Features:
 * - Hero mode: Larger typography (h1/h2)
 * - Normal mode: Standard typography (h2/h3)
 * - Light/dark variant support
 * - Optional category label above headline
 * - Alignment control
 */

import { DeckComponent } from '../../base';
import type { ComponentMeta } from '../../types';
import { PropertyGroups, CommonProperties } from '../../types';
import { styles } from './styles';

export class DeckHeadlineSubhead extends DeckComponent {
  static meta: ComponentMeta = {
    type: 'deck-headline-subhead',
    name: 'Headline + Subhead',
    description: 'Headline with optional category label and subheading text',
    category: 'content',
    icon: 'heading',
    properties: {
      headline: {
        type: 'string',
        label: 'Headline',
        required: true,
        placeholder: 'Enter headline...',
        group: PropertyGroups.CONTENT,
      },
      subheading: {
        type: 'text',
        label: 'Subheading',
        placeholder: 'Enter subheading text...',
        group: PropertyGroups.CONTENT,
      },
      category: {
        type: 'string',
        label: 'Category Label',
        placeholder: 'e.g., FEATURES, ABOUT US',
        group: PropertyGroups.CONTENT,
      },
      isHero: {
        type: 'boolean',
        label: 'Hero Mode',
        description: 'Use larger hero typography',
        default: false,
        group: PropertyGroups.STYLE,
      },
      variant: {
        type: 'enum',
        label: 'Variant',
        options: [
          { value: 'dark', label: 'Dark (dark text)' },
          { value: 'light', label: 'Light (light text)' },
        ],
        default: 'dark',
        group: PropertyGroups.STYLE,
      },
      align: {
        type: 'enum',
        label: 'Alignment',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
        ],
        default: 'left',
        group: PropertyGroups.LAYOUT,
      },
      gridWidth: CommonProperties.gridWidth(),
    },
    preview: {
      sampleProps: {
        headline: 'Your Headline Here',
        subheading: 'Supporting text that provides more context.',
        category: 'CATEGORY',
        isHero: false,
        variant: 'dark',
        align: 'left',
      },
    },
  };

  static observedAttributes = [
    'headline',
    'subheading',
    'category',
    'is-hero',
    'variant',
    'align',
    'grid-width',
  ];

  attributeChangedCallback(): void {
    this.render();
  }

  protected render(): void {
    const headline = this.getAttr('headline');
    const subheading = this.getAttr('subheading');
    const category = this.getAttr('category');
    const isHero = this.getAttrBool('is-hero');
    const variant = this.getAttr('variant', 'dark');
    const align = this.getAttr('align', 'left');

    const headlineTag = isHero ? 'h1' : 'h2';
    const subheadingTag = isHero ? 'h2' : 'h3';

    const modeClass = isHero ? 'hero' : 'normal';
    const variantClass = variant === 'light' ? 'light' : 'dark';

    const dynamicStyles = `
      :host { text-align: ${align}; }
      .subheading { ${align === 'center' ? 'margin-left: auto; margin-right: auto;' : ''} }
    `;

    this.shadow.innerHTML = `
      <style>
        ${this.getBaseStyles()}
        ${styles}
        ${dynamicStyles}
      </style>
      <div class="container ${modeClass} ${variantClass}">
        ${category ? `<p class="category">${this.escapeHtml(category)}</p>` : ''}
        ${headline ? `<${headlineTag} class="headline">${this.escapeHtml(headline)}</${headlineTag}>` : ''}
        ${subheading ? `<${subheadingTag} class="subheading">${this.escapeHtml(subheading)}</${subheadingTag}>` : ''}
      </div>
    `;
  }
}
