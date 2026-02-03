/**
 * Styles for deck-container component
 * 
 * Components set their grid-column span via the grid-width attribute.
 * The container reads this and applies grid-column: span N.
 */
export const styles = `
  :host {
    display: grid;
    gap: var(--deck-grid-gap, 1rem);
  }

  /* Grid column spans for children based on grid-width attribute */
  ::slotted([grid-width="0"]) { grid-column: 1 / -1; }
  ::slotted([grid-width="1"]) { grid-column: span 1; }
  ::slotted([grid-width="2"]) { grid-column: span 2; }
  ::slotted([grid-width="3"]) { grid-column: span 3; }
  ::slotted([grid-width="4"]) { grid-column: span 4; }
  ::slotted([grid-width="5"]) { grid-column: span 5; }
  ::slotted([grid-width="6"]) { grid-column: span 6; }
  ::slotted([grid-width="7"]) { grid-column: span 7; }
  ::slotted([grid-width="8"]) { grid-column: span 8; }
  ::slotted([grid-width="9"]) { grid-column: span 9; }
  ::slotted([grid-width="10"]) { grid-column: span 10; }
  ::slotted([grid-width="11"]) { grid-column: span 11; }
  ::slotted([grid-width="12"]) { grid-column: span 12; }

  /* Default: full width if no grid-width specified */
  ::slotted(:not([grid-width])) { grid-column: 1 / -1; }
`;
