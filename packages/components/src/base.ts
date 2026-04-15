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
   * Emit a render error event.
   * The editor relays these to the server so the LLM can fix its mistakes.
   */
  protected emitError(message: string): void {
    this.dispatchEvent(
      new CustomEvent('deck-render-error', {
        bubbles: true,
        composed: true,
        detail: {
          componentType: (this.constructor as DeckComponentClass).meta.type,
          componentId: this.getAttribute('data-component-id') || '',
          error: message,
        },
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
   * Get CSS for the linked hover glow effect.
   * By default targets :host; pass a selector to target an inner element instead
   * (e.g. deck-image targets '.image-wrapper').
   */
  protected getLinkedStyles(innerSelector?: string): string {
    const sel = innerSelector
      ? `:host([linked]) ${innerSelector}`
      : ':host([linked])';
    const hoverSel = innerSelector
      ? `:host([linked]:hover) ${innerSelector}`
      : ':host([linked]:hover)';
    return `
      ${sel} {
        transition: box-shadow 200ms ease, transform 200ms ease;
      }
      ${hoverSel} {
        box-shadow: 0 0 0 3px var(--deck-color-accent, #3b82f6),
                    0 0 12px 2px color-mix(in srgb, var(--deck-color-accent, #3b82f6) 40%, transparent) !important;
        transform: scale(1.02);
      }
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
