/**
 * Styles for deck-text component
 *
 * Covers plain text mode and markdown mode.
 * Uses theme tokens via CSS custom properties.
 */
export const styles = `
  :host {
    display: block;
  }

  .text {
    line-height: 1.6;
    color: inherit;
    margin: 0;
    white-space: pre-wrap;
  }

  /* Markdown mode — rendered HTML gets styling */
  .text.markdown {
    white-space: normal;
  }

  .text.markdown h1,
  .text.markdown h2,
  .text.markdown h3,
  .text.markdown h4,
  .text.markdown h5,
  .text.markdown h6 {
    margin-top: 0;
    margin-bottom: 0.5em;
    line-height: 1.3;
    font-weight: 700;
  }

  .text.markdown h1 { font-size: 1.6em; }
  .text.markdown h2 { font-size: 1.35em; }
  .text.markdown h3 { font-size: 1.15em; }

  .text.markdown p {
    margin: 0 0 0.75em;
  }

  .text.markdown p:last-child {
    margin-bottom: 0;
  }

  .text.markdown strong {
    font-weight: 600;
  }

  .text.markdown em {
    font-style: italic;
  }

  .text.markdown code {
    font-family: var(--deck-font-mono, ui-monospace, monospace);
    font-size: 0.9em;
    background: var(--deck-color-surface, rgba(0, 0, 0, 0.05));
    padding: 0.1em 0.3em;
    border-radius: 3px;
  }

  .text.markdown pre {
    background: var(--deck-color-surface, rgba(0, 0, 0, 0.05));
    padding: 0.75em 1em;
    border-radius: 6px;
    overflow-x: auto;
    margin: 0 0 0.75em;
  }

  .text.markdown pre code {
    background: none;
    padding: 0;
    font-size: 0.85em;
  }

  .text.markdown ul,
  .text.markdown ol {
    margin: 0 0 0.75em;
    padding-left: 1.5em;
  }

  .text.markdown li {
    margin-bottom: 0.25em;
  }

  .text.markdown li:last-child {
    margin-bottom: 0;
  }

  .text.markdown blockquote {
    border-left: 3px solid var(--deck-color-accent, #3b82f6);
    padding-left: 1em;
    margin: 0 0 0.75em;
    opacity: 0.85;
  }

  .text.markdown a {
    color: var(--deck-color-accent, #3b82f6);
    text-decoration: underline;
  }

  .text.markdown a:hover {
    text-decoration: none;
  }

  .text.markdown hr {
    border: none;
    border-top: 1px solid var(--deck-color-text-secondary, #64748b);
    opacity: 0.3;
    margin: 1em 0;
  }

  /* Tables */
  .text.markdown table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 0.75em;
    font-size: 0.95em;
  }

  .text.markdown table:last-child {
    margin-bottom: 0;
  }

  .text.markdown th,
  .text.markdown td {
    padding: 0.4em 0.75em;
    border: 1px solid color-mix(in srgb, var(--deck-color-text-secondary, #64748b) 30%, transparent);
    text-align: left;
  }

  .text.markdown th {
    font-weight: 600;
    background: var(--deck-color-surface, rgba(0, 0, 0, 0.05));
  }

  /* Striped rows (opt-in) */
  .text.markdown.table-striped tr:nth-child(even) td {
    background: var(--deck-color-surface, rgba(0, 0, 0, 0.05));
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
