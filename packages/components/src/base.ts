/**
 * Base class for Deckhand components.
 * 
 * All deck components extend this class and provide:
 * - Static `meta` describing the component for the inspector
 * - A `render()` method that builds the Shadow DOM
 * 
 * Components receive theme tokens via CSS custom properties (--deck-*).
 */

import type { ComponentMeta } from './types';

/**
 * Interface for component classes (constructor with static meta)
 */
export interface DeckComponentClass {
  new (): DeckComponent;
  meta: ComponentMeta;
  observedAttributes?: string[];
}

export abstract class DeckComponent extends HTMLElement {
  /**
   * Component metadata - MUST be overridden by subclasses.
   * Describes the component's properties for the inspector.
   */
  static meta: ComponentMeta;

  protected shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
  }

  /**
   * Override in subclasses to render Shadow DOM content
   */
  protected abstract render(): void;

  /**
   * Emit a change event when content is edited.
   * The inspector listens for these to update component props.
   */
  protected emitChange(property: string, value: unknown): void {
    this.dispatchEvent(
      new CustomEvent('deck-change', {
        bubbles: true,
        composed: true, // Crosses shadow DOM boundary
        detail: { property, value },
      })
    );
  }

  /**
   * Get an attribute as a specific type
   */
  protected getAttr(name: string, defaultValue = ''): string {
    return this.getAttribute(name) ?? defaultValue;
  }

  protected getAttrBool(name: string): boolean {
    return this.hasAttribute(name) && this.getAttribute(name) !== 'false';
  }

  protected getAttrNumber(name: string, defaultValue = 0): number {
    const val = this.getAttribute(name);
    return val ? parseFloat(val) : defaultValue;
  }

  /**
   * Get base styles that all components share.
   * Components can extend this with their own styles.
   */
  protected getBaseStyles(): string {
    return `
      :host {
        display: block;
        font-family: var(--deck-font-body, system-ui, sans-serif);
        color: var(--deck-color-text-primary, #1a1a2e);
        line-height: 1.5;
      }

      :host([hidden]) {
        display: none;
      }

      :host([linked]) {
        cursor: pointer !important;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      [contenteditable]:focus {
        outline: 2px solid var(--deck-color-accent, #3b82f6);
        outline-offset: 2px;
        border-radius: 2px;
      }
    `;
  }

  /**
   * Get typography styles using the theme's type scale
   */
  protected getTypographyStyles(): string {
    return `
      .text-xs { font-size: var(--deck-font-size-xs, 0.75rem); }
      .text-sm { font-size: var(--deck-font-size-sm, 0.875rem); }
      .text-md { font-size: var(--deck-font-size-md, 1rem); }
      .text-lg { font-size: var(--deck-font-size-lg, 1.25rem); }
      .text-xl { font-size: var(--deck-font-size-xl, 1.5rem); }
      .text-2xl { font-size: var(--deck-font-size-2xl, 2rem); }
      .text-3xl { font-size: var(--deck-font-size-3xl, 2.5rem); }
      .text-4xl { font-size: var(--deck-font-size-4xl, 3rem); }
      .text-5xl { font-size: var(--deck-font-size-5xl, 4rem); }
      
      .font-display { font-family: var(--deck-font-display, system-ui, sans-serif); }
      .font-body { font-family: var(--deck-font-body, system-ui, sans-serif); }
      .font-mono { font-family: var(--deck-font-mono, ui-monospace, monospace); }
      
      .font-normal { font-weight: 400; }
      .font-medium { font-weight: 500; }
      .font-semibold { font-weight: 600; }
      .font-bold { font-weight: 700; }
      
      .text-primary { color: var(--deck-color-text-primary); }
      .text-secondary { color: var(--deck-color-text-secondary); }
      .text-accent { color: var(--deck-color-accent); }
    `;
  }

  /**
   * Get spacing utility styles using the theme's space scale
   */
  protected getSpacingStyles(): string {
    return `
      .gap-xs { gap: var(--deck-space-xs, 0.25rem); }
      .gap-sm { gap: var(--deck-space-sm, 0.5rem); }
      .gap-md { gap: var(--deck-space-md, 1rem); }
      .gap-lg { gap: var(--deck-space-lg, 1.5rem); }
      .gap-xl { gap: var(--deck-space-xl, 2rem); }
      
      .p-xs { padding: var(--deck-space-xs); }
      .p-sm { padding: var(--deck-space-sm); }
      .p-md { padding: var(--deck-space-md); }
      .p-lg { padding: var(--deck-space-lg); }
      .p-xl { padding: var(--deck-space-xl); }
    `;
  }

  /**
   * Escape HTML to prevent XSS when rendering user content
   */
  protected escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
