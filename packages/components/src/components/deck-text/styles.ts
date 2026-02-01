/**
 * Styles for deck-text component
 * 
 * A rich text block with formatting support.
 * Uses theme tokens via CSS custom properties.
 */
export const styles = `
  :host {
    display: block;
  }

  .text {
    font-family: var(--deck-font-body, system-ui, sans-serif);
    font-size: var(--deck-font-size-md, 1rem);
    line-height: 1.6;
    color: var(--deck-color-text-primary, #1a1a2e);
    margin: 0;
    white-space: pre-wrap;
  }

  /* Rich text formatting */
  .text strong {
    font-weight: 600;
  }

  .text em {
    font-style: italic;
  }

  .text u {
    text-decoration: underline;
  }

  .text code {
    font-family: var(--deck-font-mono, ui-monospace, monospace);
    font-size: 0.9em;
    background: var(--deck-color-surface, rgba(0, 0, 0, 0.05));
    padding: 0.1em 0.3em;
    border-radius: 3px;
  }

  .text a {
    color: var(--deck-color-accent, #3b82f6);
    text-decoration: underline;
  }

  .text a:hover {
    text-decoration: none;
  }

  /* Editable state */
  .text[contenteditable="true"] {
    cursor: text;
    min-height: 1.6em;
  }

  .text[contenteditable="true"]:empty::before {
    content: attr(data-placeholder);
    color: var(--deck-color-text-secondary, #64748b);
    opacity: 0.6;
  }
`;
