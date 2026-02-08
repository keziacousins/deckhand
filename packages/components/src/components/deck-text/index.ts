/**
 * <deck-text> - Text/paragraph component for slides.
 * 
 * A rich text block for body copy, descriptions, etc.
 * Supports formatting (bold, italic, underline, code, links) and alignment.
 * 
 * The content attribute accepts a JSON array of rich text spans:
 * [{ text: "Hello ", bold: true }, { text: "world" }]
 */

import { DeckComponent } from '../../base';
import type { ComponentMeta } from '../../types';
import { PropertyGroups, CommonProperties } from '../../types';
import { styles } from './styles';

interface RichTextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  href?: string;
}

export class DeckText extends DeckComponent {
  static meta: ComponentMeta = {
    type: 'deck-text',
    name: 'Text',
    description: 'A rich text block for body copy and paragraphs',
    category: 'content',
    icon: 'text',
    properties: {
      content: {
        type: 'richtext',
        label: 'Content',
        required: true,
        placeholder: 'Enter text...',
        group: PropertyGroups.CONTENT,
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
      gridWidth: {
        ...CommonProperties.gridWidth(),
        compact: true,
      },
    },
    preview: {
      sampleProps: {
        content: [{ text: 'This is a sample text block with ' }, { text: 'rich text', bold: true }, { text: ' support.' }],
        align: 'left',
      },
    },
  };

  static observedAttributes = ['content', 'align', 'editable', 'grid-width'];

  attributeChangedCallback(): void {
    this.render();
  }

  protected render(): void {
    const contentAttr = this.getAttr('content', '[]');
    const align = this.getAttr('align', 'left');
    const editable = this.getAttrBool('editable');

    // Parse rich text content
    let spans: RichTextSpan[] = [];
    try {
      spans = JSON.parse(contentAttr);
      if (!Array.isArray(spans)) {
        spans = [];
      }
    } catch {
      // If not valid JSON, treat as plain text
      spans = contentAttr ? [{ text: contentAttr }] : [];
    }

    const dynamicStyles = `
      :host { text-align: ${align}; }
    `;

    this.shadow.innerHTML = `
      <style>
        ${this.getBaseStyles()}
        ${styles}
        ${dynamicStyles}
      </style>
      <p class="text"${editable ? ' contenteditable="true" data-placeholder="Enter text..."' : ''}>${this.renderSpans(spans)}</p>
    `;

    if (editable) {
      this.setupEditing();
    }
  }

  /**
   * Render rich text spans to HTML
   */
  private renderSpans(spans: RichTextSpan[]): string {
    return spans.map(span => {
      let html = this.escapeHtml(span.text);
      
      // Apply formatting - order matters for nesting
      if (span.code) {
        html = `<code>${html}</code>`;
      }
      if (span.bold) {
        html = `<strong>${html}</strong>`;
      }
      if (span.italic) {
        html = `<em>${html}</em>`;
      }
      if (span.underline) {
        html = `<u>${html}</u>`;
      }
      if (span.href) {
        html = `<a href="${this.escapeHtml(span.href)}" target="_blank" rel="noopener">${html}</a>`;
      }
      
      return html;
    }).join('');
  }

  private setupEditing(): void {
    const p = this.shadow.querySelector('p');
    if (!p) return;

    p.addEventListener('blur', () => {
      // For now, emit as plain text - rich text editing would need more work
      this.emitChange('content', [{ text: p.textContent || '' }]);
    });

    p.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Escape') {
        e.preventDefault();
        p.blur();
      }
    });
  }
}
