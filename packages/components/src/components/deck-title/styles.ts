/**
 * Styles for deck-title component
 */
export const styles = `
  :host {
    display: block;
  }

  .title {
    font-family: var(--deck-font-display, system-ui, sans-serif);
    color: var(--deck-color-text-primary, #1a1a2e);
    margin: 0;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  /* Size variants via CSS custom properties */
  :host {
    --title-size-1: var(--deck-font-size-4xl, 3rem);
    --title-size-2: var(--deck-font-size-3xl, 2.5rem);
    --title-size-3: var(--deck-font-size-2xl, 2rem);
  }
`;
