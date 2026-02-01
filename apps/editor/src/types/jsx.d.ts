/**
 * Global JSX type declarations for deck-* custom elements
 * 
 * This provides a permissive type that allows any deck-* element
 * with string attributes, eliminating the need for per-component
 * JSX type declarations.
 */

import 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Permissive type for all deck-* custom elements
      // Allows any attribute as a string, which matches HTML attribute behavior
      [key: `deck-${string}`]: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & Record<string, string | undefined>,
        HTMLElement
      >;
    }
  }
}
