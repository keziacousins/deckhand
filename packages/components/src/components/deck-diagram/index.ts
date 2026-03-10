/**
 * <deck-diagram> - Diagram primitive for slides.
 *
 * Renders Mermaid syntax as an SVG diagram inside Shadow DOM.
 * Supports theme switching (default/dark/neutral/forest).
 * Debounces rendering to handle rapid attribute changes during LLM streaming.
 */

import { DeckComponent } from '../../base';
import type { ComponentMeta } from '../../types';
import { PropertyGroups, CommonProperties } from '../../types';
import mermaid from 'mermaid';

let renderCounter = 0;
let lastMermaidConfig = '';

export class DeckDiagram extends DeckComponent {
  static meta: ComponentMeta = {
    type: 'deck-diagram',
    name: 'Diagram',
    description: 'Mermaid diagram — flowcharts, sequence diagrams, ER diagrams, etc.',
    category: 'data',
    icon: 'diagram',
    properties: {
      source: {
        type: 'text',
        label: 'Mermaid source',
        required: true,
        placeholder: 'graph TD\n  A-->B',
        group: PropertyGroups.CONTENT,
      },
      theme: {
        type: 'enum',
        label: 'Theme',
        options: [
          { value: 'auto', label: 'Auto' },
          { value: 'default', label: 'Default' },
          { value: 'dark', label: 'Dark' },
          { value: 'neutral', label: 'Neutral' },
          { value: 'forest', label: 'Forest' },
        ],
        default: 'auto',
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
        source: 'graph TD\n  A[Start] --> B[End]',
        theme: 'auto',
      },
    },
  };

  static observedAttributes = ['source', 'theme', 'grid-width', 'linked'];

  private _renderTimer: ReturnType<typeof setTimeout> | null = null;

  attributeChangedCallback(): void {
    // Debounce rendering to avoid thrashing during LLM streaming
    if (this._renderTimer) clearTimeout(this._renderTimer);
    this._renderTimer = setTimeout(() => {
      this._renderTimer = null;
      this.render();
    }, 100);
  }

  disconnectedCallback(): void {
    if (this._renderTimer) {
      clearTimeout(this._renderTimer);
      this._renderTimer = null;
    }
  }

  protected render(): void {
    const source = this.getAttr('source', '');
    const theme = this.getAttr('theme', 'auto');

    const linkedStyles = `
      :host([linked]) {
        transition: box-shadow 200ms ease, transform 200ms ease;
      }
      :host([linked]:hover) {
        box-shadow: 0 0 0 3px var(--deck-color-accent, #3b82f6),
                    0 0 12px 2px color-mix(in srgb, var(--deck-color-accent, #3b82f6) 40%, transparent);
        transform: scale(1.02);
      }
    `;

    if (!source.trim()) {
      this.shadow.innerHTML = `
        <style>
          ${this.getBaseStyles()}
          .placeholder {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 80px;
            color: var(--deck-color-text-secondary, #64748b);
            font-size: var(--deck-font-size-sm, 0.875rem);
            opacity: 0.6;
          }
          ${linkedStyles}
        </style>
        <div class="placeholder">No diagram source</div>
      `;
      return;
    }

    // Read inherited deck theme tokens from computed styles
    const computed = getComputedStyle(this);
    const fontFamily = computed.getPropertyValue('--deck-font-body').trim() || undefined;
    const textColor = computed.getPropertyValue('--deck-color-text-primary').trim() || undefined;
    const bgColor = computed.getPropertyValue('--deck-color-background').trim() || undefined;
    const accentColor = computed.getPropertyValue('--deck-color-accent').trim() || undefined;
    const surfaceColor = computed.getPropertyValue('--deck-color-surface').trim() || undefined;
    const textSecondary = computed.getPropertyValue('--deck-color-text-secondary').trim() || undefined;

    // Build mermaid config — 'auto' uses base theme with deck tokens, others use named themes
    const isAuto = theme === 'auto';
    const mermaidTheme = isAuto ? 'base' : theme;
    const themeVariables: Record<string, string> = {};

    if (fontFamily) themeVariables.fontFamily = fontFamily;

    if (isAuto) {
      // Map deck tokens to Mermaid's full theme variable palette
      if (accentColor) {
        themeVariables.primaryColor = accentColor;
      }
      if (bgColor) {
        themeVariables.background = bgColor;
        themeVariables.mainBkg = bgColor;
        themeVariables.secondBkg = bgColor;
      }
      if (surfaceColor) {
        themeVariables.nodeBkg = surfaceColor;
        themeVariables.defaultLinkColor = surfaceColor;
      }
      if (textColor) {
        themeVariables.primaryTextColor = textColor;
        themeVariables.secondaryTextColor = textColor;
        themeVariables.tertiaryTextColor = textColor;
        themeVariables.nodeTextColor = textColor;
        themeVariables.titleColor = textColor;
      }
      if (textSecondary) {
        themeVariables.lineColor = textSecondary;
        themeVariables.primaryBorderColor = textSecondary;
        themeVariables.secondaryBorderColor = textSecondary;
        themeVariables.tertiaryBorderColor = textSecondary;
      }
    } else {
      // Named themes: just pass through text color for consistency
      if (textColor) {
        themeVariables.primaryTextColor = textColor;
        themeVariables.secondaryTextColor = textColor;
        themeVariables.tertiaryTextColor = textColor;
      }
    }

    // Re-initialize mermaid only when config changes
    const configKey = `${mermaidTheme}|${JSON.stringify(themeVariables)}`;
    if (configKey !== lastMermaidConfig) {
      mermaid.initialize({
        startOnLoad: false,
        theme: mermaidTheme as any,
        themeVariables,
        logLevel: 'error' as any,
      });
      lastMermaidConfig = configKey;
    }

    const id = `deck-diagram-${++renderCounter}`;

    mermaid.render(id, source).then(({ svg }) => {
      this.shadow.innerHTML = `
        <style>
          ${this.getBaseStyles()}
          :host {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .diagram {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .diagram svg {
            max-width: 100%;
            height: auto;
          }
          ${linkedStyles}
        </style>
        <div class="diagram">${svg}</div>
      `;
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.shadow.innerHTML = `
        <style>
          ${this.getBaseStyles()}
          .error {
            padding: 0.75em 1em;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 6px;
            color: #ef4444;
            font-size: var(--deck-font-size-sm, 0.875rem);
            font-family: var(--deck-font-mono, ui-monospace, monospace);
            white-space: pre-wrap;
            word-break: break-word;
          }
          ${linkedStyles}
        </style>
        <div class="error">${this.escapeHtml(message)}</div>
      `;
    });
  }
}
