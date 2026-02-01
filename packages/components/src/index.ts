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
export { DeckTitle } from './components/deck-title';
export { DeckHeadlineSubhead } from './components/deck-headline-subhead';
export { DeckText } from './components/deck-text';
export { DeckList } from './components/deck-list';
export { DeckImage } from './components/deck-image';

// Import components for registration
import { DeckSlide } from './components/deck-slide';
import { DeckTitle } from './components/deck-title';
import { DeckHeadlineSubhead } from './components/deck-headline-subhead';
import { DeckText } from './components/deck-text';
import { DeckList } from './components/deck-list';
import { DeckImage } from './components/deck-image';
import { registry } from './registry';

/**
 * Register all built-in components.
 * Call this once on app startup.
 */
export function registerComponents(): void {
  // Add components to registry
  registry.add(DeckSlide);
  registry.add(DeckTitle);
  registry.add(DeckHeadlineSubhead);
  registry.add(DeckText);
  registry.add(DeckList);
  registry.add(DeckImage);
  
  // Define custom elements
  registry.registerAll();
}
