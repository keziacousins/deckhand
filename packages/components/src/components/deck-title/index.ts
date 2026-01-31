/**
 * <deck-title> - Heading component for slides.
 * 
 * Supports h1-h3 levels and text alignment.
 * Uses the theme's display font and type scale.
 */

import { DeckComponent } from '../../base';
import type { ComponentMeta } from '../../types';
import { PropertyGroups, CommonProperties } from '../../types';
import { styles } from './styles';

export class DeckTitle extends DeckComponent {
  static meta: ComponentMeta = {
    type: 'deck-title',
    name: 'Title',
    description: 'Heading text for slides. Supports multiple levels.',
    category: 'content',
    icon: 'heading',
    properties: {
      text: {
        type: 'string',
        label: 'Text',
        required: true,
        placeholder: 'Enter title...',
        group: PropertyGroups.CONTENT,
      },
      level: {
        type: 'enum',
        label: 'Level',
        description: 'Heading level (1 = largest)',
        options: [
          { value: '1', label: 'H1 - Main Title' },
          { value: '2', label: 'H2 - Section' },
          { value: '3', label: 'H3 - Subsection' },
        ],
        default: '1',
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
        default: 'center',
        group: PropertyGroups.LAYOUT,
      },
      gridWidth: CommonProperties.gridWidth(),
    },
    preview: {
      sampleProps: {
        text: 'Sample Title',
        level: '1',
        align: 'center',
      },
    },
  };

  static observedAttributes = ['text', 'level', 'align', 'editable', 'grid-width'];

  attributeChangedCallback(): void {
    this.render();
  }

  protected render(): void {
    const text = this.getAttr('text', '');
    const level = this.getAttr('level', '1');
    const align = this.getAttr('align', 'center');
    const editable = this.getAttrBool('editable');

    const dynamicStyles = `
      :host { text-align: ${align}; }
      .title { font-size: var(--title-size-${level}); }
    `;

    this.shadow.innerHTML = `
      <style>
        ${this.getBaseStyles()}
        ${styles}
        ${dynamicStyles}
      </style>
      <h${level} class="title"${editable ? ' contenteditable="true"' : ''}>${this.escapeHtml(text)}</h${level}>
    `;

    if (editable) {
      this.setupEditing(level);
    }
  }

  private setupEditing(level: string): void {
    const heading = this.shadow.querySelector(`h${level}`);
    if (!heading) return;

    heading.addEventListener('blur', () => {
      this.emitChange('text', heading.textContent || '');
    });

    heading.addEventListener('keydown', (e: Event) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        e.preventDefault();
        (heading as HTMLElement).blur();
      }
    });
  }
}
