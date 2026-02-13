import type { Deck, Slide, Component, AspectRatio } from '@deckhand/schema';
import type { Selection } from '../selection';

export type InspectorTab = 'selection' | 'theme' | 'assets' | 'chat';

export interface InspectorContext {
  deck: Deck;
  selection: Selection;
  selectedSlide: Slide | null;
  selectedComponent: Component | null;
  onUpdate: (update: InspectorUpdate) => void;
  onAddComponent?: (componentType: string, parentId?: string) => void;
  onDeleteComponent?: (slideId: string, componentId: string) => void;
  onReorderComponent?: (slideId: string, componentId: string, direction: 'up' | 'down') => void;
  onReorderComponents?: (slideId: string, components: Component[]) => void;
  onMoveComponentToContainer?: (slideId: string, componentId: string, newParentId: string | null) => void;
  /** Add, update, or remove a component link (edge from component to slide) */
  onComponentLinkChange?: (componentId: string, targetSlideId: string | null) => void;
}

export type InspectorUpdate =
  | { type: 'slide'; slideId: string; field: 'title' | 'notes'; value: string }
  | { type: 'slide'; slideId: string; field: 'gridColumns'; value: number | undefined }
  | { type: 'slide'; slideId: string; field: 'style'; value: Record<string, string | number | boolean | undefined> }
  | { type: 'component'; slideId: string; componentId: string; field: string; value: unknown }
  | { type: 'deck'; field: 'title' | 'description'; value: string }
  | { type: 'deck'; field: 'aspectRatio'; value: AspectRatio }
  | { type: 'deck'; field: 'gridColumns'; value: number }
  | { type: 'deck'; field: 'defaultBackdropSlideId'; value: string | undefined }
  | { type: 'deck'; field: 'defaultStartPointId'; value: string | undefined }
  | { type: 'deck'; field: 'assets'; value: Record<string, unknown> }
  | { type: 'addAsset'; asset: unknown }
  | { type: 'theme'; field: string; value: string | number | undefined };

export interface InspectorSectionProps {
  context: InspectorContext;
  /** Index for sticky header stacking — determines top offset and z-index */
  stickyIndex?: number;
}

/**
 * Scroll a section header to its sticky position within .inspector-content,
 * maximizing visibility of the body content below.
 *
 * Computes the header's natural document position by summing the heights of
 * all preceding siblings, since sticky positioning and offsetTop can both
 * report the stuck visual position rather than the layout position.
 */
export function scrollHeaderToSticky(header: HTMLElement) {
  const scrollContainer = header.closest('.inspector-content');
  if (!scrollContainer) return;

  const stickyTop = parseInt(getComputedStyle(header).getPropertyValue('--sticky-top') || '0', 10);

  // Sum heights of all preceding siblings to find natural position
  let naturalTop = 0;
  let sibling = scrollContainer.firstElementChild as HTMLElement | null;
  while (sibling && sibling !== header) {
    naturalTop += sibling.offsetHeight;
    sibling = sibling.nextElementSibling as HTMLElement | null;
  }

  const desiredScrollTop = naturalTop - stickyTop;

  if (Math.abs(scrollContainer.scrollTop - desiredScrollTop) > 1) {
    scrollContainer.scrollTo({
      top: desiredScrollTop,
      behavior: 'smooth',
    });
  }
}
