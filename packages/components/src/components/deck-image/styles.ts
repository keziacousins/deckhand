/**
 * Styles for deck-image component
 */
export const styles = `
  :host {
    display: block;
  }

  .image-container {
    position: relative;
    width: 100%;
  }

  .image {
    display: block;
    width: 100%;
    height: auto;
    border-radius: var(--deck-radius-md, 8px);
  }

  /* Fit modes */
  :host([fit="contain"]) .image {
    object-fit: contain;
    max-height: 100%;
  }

  :host([fit="cover"]) .image {
    object-fit: cover;
  }

  :host([fit="fill"]) .image {
    object-fit: fill;
  }

  /* Caption styling */
  .caption {
    margin-top: 0.75em;
    font-family: var(--deck-font-body, system-ui, sans-serif);
    font-size: var(--deck-font-size-small, 0.875rem);
    color: var(--deck-color-text-secondary, #64748b);
    text-align: center;
  }

  /* Placeholder when no image */
  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 200px;
    background: var(--deck-color-surface, #f1f5f9);
    border: 2px dashed var(--deck-color-border, #cbd5e1);
    border-radius: var(--deck-radius-md, 8px);
    color: var(--deck-color-text-secondary, #64748b);
    font-family: var(--deck-font-body, system-ui, sans-serif);
    font-size: var(--deck-font-size-body, 1rem);
  }

  .placeholder-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 0.5em;
    opacity: 0.5;
  }

  .placeholder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
`;
