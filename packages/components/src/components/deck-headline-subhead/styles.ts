/**
 * Styles for deck-headline-subhead component
 * 
 * Self-contained styles - no external CSS dependencies.
 * Uses theme tokens via CSS custom properties.
 */
export const styles = `
  :host {
    display: block;
  }

  .container {
    display: flex;
    flex-direction: column;
    gap: var(--deck-space-md, 1rem);
  }

  /* Category label */
  .category {
    font-family: var(--deck-font-body, system-ui, sans-serif);
    font-size: var(--deck-font-size-sm, 0.875rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0;
  }

  /* Headline */
  .headline {
    font-family: var(--deck-font-display, system-ui, sans-serif);
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin: 0;
  }

  /* Subheading */
  .subheading {
    font-family: var(--deck-font-body, system-ui, sans-serif);
    font-weight: 400;
    line-height: 1.5;
    margin: 0;
    max-width: 65ch;
  }

  /* === Mode: Normal === */
  .normal .headline {
    font-size: var(--deck-font-size-3xl, 2rem);
    font-weight: 700;
  }

  .normal .subheading {
    font-size: var(--deck-font-size-lg, 1.125rem);
  }

  /* === Mode: Hero === */
  .hero .headline {
    font-size: var(--deck-font-size-5xl, 3.5rem);
    font-weight: 500;
  }

  .hero .subheading {
    font-size: var(--deck-font-size-xl, 1.25rem);
  }

  /* === Variant: Dark (dark text on light bg) === */
  .dark .category {
    color: var(--deck-color-accent, #3b82f6);
  }

  .dark .headline {
    color: var(--deck-color-text-primary, #1a1a2e);
  }

  .dark .subheading {
    color: var(--deck-color-text-secondary, #64748b);
  }

  /* === Variant: Light (light text on dark bg) === */
  .light .category {
    color: rgba(255, 255, 255, 0.7);
  }

  .light .headline {
    color: var(--deck-color-accent-contrast, #ffffff);
  }

  .light .subheading {
    color: rgba(255, 255, 255, 0.8);
  }
`;
