/**
 * <deck-text> - Universal text primitive for slides.
 *
 * Content is a plain string. When markdown="true", rendered as
 * GitHub-flavored markdown via `marked`. Otherwise rendered as
 * escaped plain text in a <p> tag.
 *
 * Supports size, weight, alignment, text-transform, and color overrides.
 */

import { DeckComponent } from '../../base';
import type { ComponentMeta } from '../../types';
import { PropertyGroups, CommonProperties } from '../../types';
import { marked } from 'marked';
import { styles } from './styles';

// Configure marked for synchronous, inline-friendly rendering
marked.setOptions({ async: false, gfm: true, breaks: true });

export class DeckText extends DeckComponent {
  static meta: ComponentMeta = {
    type: 'deck-text',
    name: 'Text',
    description: 'Universal text block — plain or markdown',
    category: 'content',
    icon: 'text',
    properties: {
      content: {
        type: 'text',
        label: 'Content',
        required: true,
        placeholder: 'Enter text...',
        group: PropertyGroups.CONTENT,
      },
      markdown: {
        type: 'boolean',
        label: 'Markdown',
        default: false,
        group: PropertyGroups.CONTENT,
        compact: true,
      },
      size: {
        type: 'enum',
        label: 'Size',
        options: [
          { value: 'xs', label: 'XS' },
          { value: 'sm', label: 'SM' },
          { value: 'md', label: 'MD' },
          { value: 'lg', label: 'LG' },
          { value: 'xl', label: 'XL' },
          { value: '2xl', label: '2XL' },
          { value: 'display', label: 'Display' },
        ],
        default: 'md',
        group: PropertyGroups.STYLE,
        compact: true,
      },
      weight: {
        type: 'enum',
        label: 'Weight',
        options: [
          { value: 'normal', label: 'Normal' },
          { value: 'medium', label: 'Medium' },
          { value: 'semibold', label: 'Semibold' },
          { value: 'bold', label: 'Bold' },
        ],
        default: 'normal',
        group: PropertyGroups.STYLE,
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
      transform: {
        type: 'enum',
        label: 'Transform',
        options: [
          { value: 'none', label: 'None' },
          { value: 'uppercase', label: 'Uppercase' },
          { value: 'lowercase', label: 'Lowercase' },
          { value: 'capitalize', label: 'Capitalize' },
        ],
        default: 'none',
        group: PropertyGroups.STYLE,
        compact: true,
      },
      color: {
        type: 'color',
        label: 'Color',
        group: PropertyGroups.STYLE,
        compact: true,
      },
      gridWidth: {
        ...CommonProperties.gridWidth(),
        compact: true,
      },
    },
    preview: {
      sampleProps: {
        content: 'This is a sample text block.',
        size: 'md',
        align: 'left',
      },
    },
  };

  static observedAttributes = [
    'content', 'markdown', 'size', 'weight', 'align',
    'transform', 'color', 'editable', 'grid-width',
  ];

  attributeChangedCallback(): void {
    this.render();
  }

  protected render(): void {
    const content = this.getAttr('content', '');
    const isMarkdown = this.getAttrBool('markdown');
    const size = this.getAttr('size', 'md');
    const weight = this.getAttr('weight', 'normal');
    const align = this.getAttr('align', 'left');
    const transform = this.getAttr('transform', 'none');
    const color = this.getAttr('color', '');
    const editable = this.getAttrBool('editable');

    const sizeMap: Record<string, string> = {
      xs: 'var(--deck-font-size-xs, 0.75rem)',
      sm: 'var(--deck-font-size-sm, 0.875rem)',
      md: 'var(--deck-font-size-md, 1rem)',
      lg: 'var(--deck-font-size-lg, 1.25rem)',
      xl: 'var(--deck-font-size-xl, 1.5rem)',
      '2xl': 'var(--deck-font-size-2xl, 2rem)',
      display: 'var(--deck-font-size-5xl, 4rem)',
    };

    const weightMap: Record<string, string> = {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    };

    const fontFamily = size === 'display'
      ? 'var(--deck-font-display, system-ui, sans-serif)'
      : 'var(--deck-font-body, system-ui, sans-serif)';

    const dynamicStyles = `
      :host {
        text-align: ${align};
        font-size: ${sizeMap[size] || sizeMap.md};
        font-weight: ${weightMap[weight] || '400'};
        font-family: ${fontFamily};
        text-transform: ${transform === 'none' ? 'none' : transform};
        ${color ? `color: ${color};` : ''}
      }
    `;

    let bodyHtml: string;
    if (isMarkdown) {
      bodyHtml = `<div class="text markdown"${editable ? ' contenteditable="true" data-placeholder="Enter markdown..."' : ''}>${marked.parse(content) as string}</div>`;
    } else {
      bodyHtml = `<p class="text"${editable ? ' contenteditable="true" data-placeholder="Enter text..."' : ''}>${this.escapeHtml(content)}</p>`;
    }

    this.shadow.innerHTML = `
      <style>
        ${this.getBaseStyles()}
        ${styles}
        ${dynamicStyles}
      </style>
      ${bodyHtml}
    `;

    if (editable) {
      this.setupEditing();
    }
  }

  private setupEditing(): void {
    const el = this.shadow.querySelector('.text');
    if (!el) return;

    el.addEventListener('blur', () => {
      this.emitChange('content', (el as HTMLElement).textContent || '');
    });

    el.addEventListener('keydown', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Escape') {
        e.preventDefault();
        (el as HTMLElement).blur();
      }
    });
  }
}
