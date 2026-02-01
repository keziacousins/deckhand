/**
 * Styles for deck-list component
 */
export const styles = `
  .list {
    font-family: var(--deck-font-body, system-ui, sans-serif);
    font-size: var(--deck-font-size-body, 1.25rem);
    line-height: 1.6;
    color: var(--deck-color-text-primary, #1a1a2e);
    margin: 0;
    padding-left: 1.5em;
  }

  .list li {
    margin-bottom: 0.5em;
  }

  .list li:last-child {
    margin-bottom: 0;
  }

  /* Unordered list styling */
  ul.list {
    list-style-type: disc;
  }

  ul.list ul {
    list-style-type: circle;
    margin-top: 0.5em;
  }

  /* Ordered list styling */
  ol.list {
    list-style-type: decimal;
  }

  ol.list ol {
    list-style-type: lower-alpha;
    margin-top: 0.5em;
  }

  /* Accent color for markers */
  .list::marker,
  .list li::marker {
    color: var(--deck-color-accent, #3b82f6);
  }
`;
