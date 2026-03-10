/**
 * Deckhand Web Components
 *
 * Self-describing custom elements for rendering slide content.
 * Each component declares its metadata (properties, category, etc.)
 * which the inspector uses to auto-generate editors.
 */

// Types
export * from './types';

// Base class
export { DeckComponent } from './base';
export type { DeckComponentClass } from './base';

// Registry
export { registry, registerComponent } from './registry';

// Components (each in its own directory)
export { DeckSlide } from './components/deck-slide';
export { DeckText } from './components/deck-text';
export { DeckImage } from './components/deck-image';
export { DeckContainer } from './components/deck-container';
export { DeckDiagram } from './components/deck-diagram';

// Import components for registration
import { DeckSlide } from './components/deck-slide';
import { DeckText } from './components/deck-text';
import { DeckImage } from './components/deck-image';
import { DeckContainer } from './components/deck-container';
import { DeckDiagram } from './components/deck-diagram';
import { registry } from './registry';

/**
 * Register all built-in components.
 * Call this once on app startup.
 */
export function registerComponents(): void {
  // Add components to registry
  registry.add(DeckSlide);
  registry.add(DeckText);
  registry.add(DeckImage);
  registry.add(DeckContainer);
  registry.add(DeckDiagram);

  // Define custom elements
  registry.registerAll();
}
