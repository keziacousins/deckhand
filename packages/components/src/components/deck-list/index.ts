/**
 * <deck-list> - List component for slides.
 * 
 * Supports both ordered (numbered) and unordered (bullet) lists.
 * Items are passed as a JSON array of strings.
 */

import { DeckComponent } from '../../base';
import type { ComponentMeta } from '../../types';
import { PropertyGroups, CommonProperties } from '../../types';
import { styles } from './styles';

export class DeckList extends DeckComponent {
  static meta: ComponentMeta = {
    type: 'deck-list',
    name: 'List',
    description: 'Bulleted or numbered list of items',
    category: 'content',
    icon: 'list',
    properties: {
      items: {
        type: 'text',
        label: 'Items',
        description: 'One item per line',
        required: true,
        placeholder: 'Enter list items (one per line)...',
        group: PropertyGroups.CONTENT,
      },
      ordered: {
        type: 'boolean',
        label: 'Numbered',
        description: 'Use numbered list instead of bullets',
        default: false,
        group: PropertyGroups.STYLE,
      },
      gridWidth: CommonProperties.gridWidth(),
    },
    preview: {
      sampleProps: {
        items: ['First item', 'Second item', 'Third item'],
        ordered: false,
      },
    },
  };

  static observedAttributes = ['items', 'ordered', 'grid-width'];

  attributeChangedCallback(): void {
    this.render();
  }

  protected render(): void {
    const itemsAttr = this.getAttr('items', '[]');
    const ordered = this.getAttrBool('ordered');

    // Parse items - can be JSON array or plain text (one item per line)
    let items: string[] = [];
    try {
      const parsed = JSON.parse(itemsAttr);
      if (Array.isArray(parsed)) {
        items = parsed.map(item => String(item));
      }
    } catch {
      // If not valid JSON, treat as newline-separated text
      items = itemsAttr.split('\n').filter(line => line.trim());
    }

    const tag = ordered ? 'ol' : 'ul';
    const listItems = items
      .map(item => `<li>${this.escapeHtml(item)}</li>`)
      .join('\n');

    this.shadow.innerHTML = `
      <style>
        ${this.getBaseStyles()}
        ${styles}
      </style>
      <${tag} class="list">
        ${listItems}
      </${tag}>
    `;
  }
}
