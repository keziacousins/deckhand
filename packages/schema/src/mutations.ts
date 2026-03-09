/**
 * Domain mutation functions for Deck documents.
 * 
 * These pure functions take a Deck and return a new Deck with the mutation applied.
 * They are used by both the frontend and LLM tools to ensure consistent behavior.
 */

import type { Deck, Slide, Component, SlideStyle, Edge, StartPoint, TransitionType, EdgeTrigger, AspectRatio, StandardTokens } from './index';
import { SLIDE_WIDTH } from './deck.js';

const SLIDE_GAP = 80;

/**
 * Generate a unique ID with prefix
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Calculate position for a new slide based on existing slides
 */
function calculateNewSlidePosition(deck: Deck): { x: number; y: number } {
  const slides = Object.values(deck.slides);
  if (slides.length === 0) {
    return { x: 0, y: 0 };
  }

  // Find rightmost slide and place new one to the right with proper gap
  const maxX = Math.max(...slides.map(s => s.position.x));
  return { x: maxX + SLIDE_WIDTH + SLIDE_GAP, y: 0 };
}

// ============================================================================
// Slide Mutations
// ============================================================================

export interface AddSlideOptions {
  title?: string;
  afterSlideId?: string;
  position?: { x: number; y: number };
}

/**
 * Add a new slide to the deck
 */
export function addSlide(deck: Deck, options: AddSlideOptions = {}): { deck: Deck; slideId: string } {
  const slideId = generateId('slide');
  const position = options.position ?? calculateNewSlidePosition(deck);
  
  const newSlide: Slide = {
    id: slideId,
    title: options.title || 'New Slide',
    components: [],
    position,
  };

  const newDeck: Deck = {
    ...deck,
    slides: {
      ...deck.slides,
      [slideId]: newSlide,
    },
  };

  return { deck: newDeck, slideId };
}

export interface UpdateSlideOptions {
  title?: string;
  notes?: string;
  gridColumns?: number;
  style?: Partial<SlideStyle>;
}

/**
 * Update a slide's properties
 */
export function updateSlide(deck: Deck, slideId: string, updates: UpdateSlideOptions): Deck {
  const slide = deck.slides[slideId];
  if (!slide) {
    throw new Error(`Slide ${slideId} not found`);
  }

  const updatedSlide: Slide = { ...slide };

  if (updates.title !== undefined) {
    updatedSlide.title = updates.title;
  }
  if (updates.notes !== undefined) {
    updatedSlide.notes = updates.notes;
  }
  if (updates.gridColumns !== undefined) {
    updatedSlide.gridColumns = updates.gridColumns;
  }
  if (updates.style !== undefined) {
    updatedSlide.style = {
      ...slide.style,
      ...updates.style,
    };
    // Clean up undefined values
    if (updatedSlide.style) {
      for (const key of Object.keys(updatedSlide.style)) {
        if (updatedSlide.style[key as keyof SlideStyle] === undefined) {
          delete updatedSlide.style[key as keyof SlideStyle];
        }
      }
      if (Object.keys(updatedSlide.style).length === 0) {
        delete updatedSlide.style;
      }
    }
  }

  return {
    ...deck,
    slides: {
      ...deck.slides,
      [slideId]: updatedSlide,
    },
  };
}

/**
 * Delete a slide from the deck
 */
export function deleteSlide(deck: Deck, slideId: string): Deck {
  if (!deck.slides[slideId]) {
    throw new Error(`Slide ${slideId} not found`);
  }

  const { [slideId]: _, ...remainingSlides } = deck.slides;

  // Remove edges connected to this slide
  const remainingEdges = Object.fromEntries(
    Object.entries(deck.flow.edges).filter(
      ([, edge]) => edge.from !== slideId && edge.to !== slideId
    )
  );

  return {
    ...deck,
    slides: remainingSlides,
    flow: {
      ...deck.flow,
      edges: remainingEdges,
    },
  };
}

// ============================================================================
// Component Mutations
// ============================================================================

export interface AddComponentOptions {
  type: string;
  props: Record<string, unknown>;
  position?: number;
  parentId?: string; // ID of container to add inside
}

/**
 * Add a component to a slide
 */
export function addComponent(
  deck: Deck,
  slideId: string,
  options: AddComponentOptions
): { deck: Deck; componentId: string } {
  const slide = deck.slides[slideId];
  if (!slide) {
    throw new Error(`Slide ${slideId} not found`);
  }

  // Validate parentId if provided
  if (options.parentId) {
    const parentComponent = slide.components.find(c => c.id === options.parentId);
    if (!parentComponent) {
      throw new Error(`Parent container ${options.parentId} not found in slide ${slideId}`);
    }
    if (parentComponent.type !== 'deck-container') {
      throw new Error(`Parent ${options.parentId} is not a container`);
    }
    // Prevent nesting containers inside containers
    if (options.type === 'deck-container') {
      throw new Error('Containers cannot be nested inside other containers');
    }
  }

  const componentId = generateId('comp');
  const newComponent: Component = {
    id: componentId,
    ...(options.parentId && { parentId: options.parentId }),
    type: options.type,
    props: options.props,
  } as Component;

  const components = [...slide.components];
  if (options.position !== undefined && options.position < components.length) {
    components.splice(options.position, 0, newComponent);
  } else {
    components.push(newComponent);
  }

  return {
    deck: {
      ...deck,
      slides: {
        ...deck.slides,
        [slideId]: {
          ...slide,
          components,
        },
      },
    },
    componentId,
  };
}

/**
 * Update a component's props
 */
export function updateComponent(
  deck: Deck,
  slideId: string,
  componentId: string,
  props: Record<string, unknown>
): Deck {
  const slide = deck.slides[slideId];
  if (!slide) {
    throw new Error(`Slide ${slideId} not found`);
  }

  const componentIndex = slide.components.findIndex(c => c.id === componentId);
  if (componentIndex === -1) {
    throw new Error(`Component ${componentId} not found in slide ${slideId}`);
  }

  const component = slide.components[componentIndex];
  const updatedComponent = {
    ...component,
    props: {
      ...component.props,
      ...props,
    },
  } as Component;

  const components = [...slide.components];
  components[componentIndex] = updatedComponent;

  return {
    ...deck,
    slides: {
      ...deck.slides,
      [slideId]: {
        ...slide,
        components,
      },
    },
  };
}

/**
 * Delete a component from a slide.
 * If the component is a container, also deletes all child components.
 */
export function deleteComponent(deck: Deck, slideId: string, componentId: string): Deck {
  const slide = deck.slides[slideId];
  if (!slide) {
    throw new Error(`Slide ${slideId} not found`);
  }

  const componentIndex = slide.components.findIndex(c => c.id === componentId);
  if (componentIndex === -1) {
    throw new Error(`Component ${componentId} not found in slide ${slideId}`);
  }

  // Get IDs to delete: the component itself + any children (if it's a container)
  const idsToDelete = new Set<string>([componentId]);
  const component = slide.components[componentIndex];
  
  if (component.type === 'deck-container') {
    // Find all children of this container
    for (const c of slide.components) {
      if (c.parentId === componentId) {
        idsToDelete.add(c.id);
      }
    }
  }

  const components = slide.components.filter(c => !idsToDelete.has(c.id));

  // Remove edges that reference any deleted component as source
  const remainingEdges = Object.fromEntries(
    Object.entries(deck.flow.edges).filter(
      ([, edge]) => !idsToDelete.has(edge.from)
    )
  );

  return {
    ...deck,
    slides: {
      ...deck.slides,
      [slideId]: {
        ...slide,
        components,
      },
    },
    flow: {
      ...deck.flow,
      edges: remainingEdges,
    },
  };
}

/**
 * Reorder a component within a slide
 */
export function reorderComponent(
  deck: Deck,
  slideId: string,
  componentId: string,
  direction: 'up' | 'down'
): Deck {
  const slide = deck.slides[slideId];
  if (!slide) {
    throw new Error(`Slide ${slideId} not found`);
  }

  const index = slide.components.findIndex(c => c.id === componentId);
  if (index === -1) {
    throw new Error(`Component ${componentId} not found in slide ${slideId}`);
  }

  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= slide.components.length) {
    return deck; // Can't move further
  }

  const components = [...slide.components];
  [components[index], components[newIndex]] = [components[newIndex], components[index]];

  return {
    ...deck,
    slides: {
      ...deck.slides,
      [slideId]: {
        ...slide,
        components,
      },
    },
  };
}

// ============================================================================
// Edge Mutations
// ============================================================================

export interface AddEdgeOptions {
  from: string;
  to: string;
  trigger?: EdgeTrigger;
  label?: string;
  transition?: TransitionType;
  transitionDuration?: number;
}

/**
 * Add a navigation edge between slides (or from start point to slide)
 */
export function addEdge(deck: Deck, options: AddEdgeOptions): { deck: Deck; edgeId: string } {
  const edgeId = generateId('edge');
  
  // Validate that 'from' exists (slide, start point, or component)
  const fromIsSlide = deck.slides[options.from] !== undefined;
  const fromIsStartPoint = deck.flow.startPoints?.[options.from] !== undefined;
  const fromIsComponent = !fromIsSlide && !fromIsStartPoint && 
    Object.values(deck.slides).some(slide => slide.components.some(c => c.id === options.from));
  
  if (!fromIsSlide && !fromIsStartPoint && !fromIsComponent) {
    throw new Error(`Source ${options.from} not found (must be a slide, start point, or component)`);
  }
  
  // Validate that 'to' exists (must be a slide)
  if (!deck.slides[options.to]) {
    throw new Error(`Target slide ${options.to} not found`);
  }

  const newEdge: Edge = {
    id: edgeId,
    from: options.from,
    to: options.to,
    trigger: options.trigger ?? 'default',
    ...(options.label && { label: options.label }),
    ...(options.transition && { transition: options.transition }),
    ...(options.transitionDuration !== undefined && { transitionDuration: options.transitionDuration }),
  };

  return {
    deck: {
      ...deck,
      flow: {
        ...deck.flow,
        edges: {
          ...deck.flow.edges,
          [edgeId]: newEdge,
        },
      },
    },
    edgeId,
  };
}

export interface UpdateEdgeOptions {
  trigger?: EdgeTrigger;
  label?: string;
  transition?: TransitionType;
  transitionDuration?: number;
}

/**
 * Update an edge's properties
 */
export function updateEdge(deck: Deck, edgeId: string, updates: UpdateEdgeOptions): Deck {
  const edge = deck.flow.edges[edgeId];
  if (!edge) {
    throw new Error(`Edge ${edgeId} not found`);
  }

  const updatedEdge: Edge = { ...edge };

  if (updates.trigger !== undefined) {
    updatedEdge.trigger = updates.trigger;
  }
  if (updates.label !== undefined) {
    updatedEdge.label = updates.label || undefined; // Remove if empty string
  }
  if (updates.transition !== undefined) {
    updatedEdge.transition = updates.transition;
  }
  if (updates.transitionDuration !== undefined) {
    updatedEdge.transitionDuration = updates.transitionDuration;
  }

  return {
    ...deck,
    flow: {
      ...deck.flow,
      edges: {
        ...deck.flow.edges,
        [edgeId]: updatedEdge,
      },
    },
  };
}

/**
 * Delete an edge from the deck
 */
export function deleteEdge(deck: Deck, edgeId: string): Deck {
  if (!deck.flow.edges[edgeId]) {
    throw new Error(`Edge ${edgeId} not found`);
  }

  const { [edgeId]: _, ...remainingEdges } = deck.flow.edges;

  return {
    ...deck,
    flow: {
      ...deck.flow,
      edges: remainingEdges,
    },
  };
}

// ============================================================================
// Start Point Mutations
// ============================================================================

export interface AddStartPointOptions {
  name: string;
  position?: { x: number; y: number };
  connectToSlide?: string; // Optionally connect to a slide immediately
}

/**
 * Add a start point to the deck
 */
export function addStartPoint(deck: Deck, options: AddStartPointOptions): { deck: Deck; startPointId: string; edgeId?: string } {
  const startPointId = generateId('start');
  
  // Calculate position if not provided - place to the left of slides
  const position = options.position ?? calculateStartPointPosition(deck);

  const newStartPoint: StartPoint = {
    id: startPointId,
    name: options.name,
    position,
  };

  let newDeck: Deck = {
    ...deck,
    flow: {
      ...deck.flow,
      startPoints: {
        ...deck.flow.startPoints,
        [startPointId]: newStartPoint,
      },
    },
  };

  // Optionally connect to a slide
  let edgeId: string | undefined;
  if (options.connectToSlide) {
    const result = addEdge(newDeck, {
      from: startPointId,
      to: options.connectToSlide,
      trigger: 'default',
    });
    newDeck = result.deck;
    edgeId = result.edgeId;
  }

  return { deck: newDeck, startPointId, edgeId };
}

/**
 * Calculate position for a new start point
 */
function calculateStartPointPosition(deck: Deck): { x: number; y: number } {
  const slides = Object.values(deck.slides);
  const startPoints = Object.values(deck.flow.startPoints ?? {});
  
  // Find leftmost position
  let minX = 0;
  if (slides.length > 0) {
    minX = Math.min(...slides.map(s => s.position.x));
  }
  
  // Place start point to the left of all slides
  const baseX = minX - 200;
  
  // Stack start points vertically
  const yOffset = startPoints.length * 100;
  
  return { x: baseX, y: yOffset };
}

export interface UpdateStartPointOptions {
  name?: string;
  position?: { x: number; y: number };
}

/**
 * Update a start point's properties
 */
export function updateStartPoint(deck: Deck, startPointId: string, updates: UpdateStartPointOptions): Deck {
  const startPoint = deck.flow.startPoints?.[startPointId];
  if (!startPoint) {
    throw new Error(`Start point ${startPointId} not found`);
  }

  const updatedStartPoint: StartPoint = { ...startPoint };

  if (updates.name !== undefined) {
    updatedStartPoint.name = updates.name;
  }
  if (updates.position !== undefined) {
    updatedStartPoint.position = updates.position;
  }

  return {
    ...deck,
    flow: {
      ...deck.flow,
      startPoints: {
        ...deck.flow.startPoints,
        [startPointId]: updatedStartPoint,
      },
    },
  };
}

/**
 * Delete a start point from the deck
 */
export function deleteStartPoint(deck: Deck, startPointId: string): Deck {
  if (!deck.flow.startPoints?.[startPointId]) {
    throw new Error(`Start point ${startPointId} not found`);
  }

  const { [startPointId]: _, ...remainingStartPoints } = deck.flow.startPoints;

  // Remove edges connected from this start point
  const remainingEdges = Object.fromEntries(
    Object.entries(deck.flow.edges).filter(
      ([, edge]) => edge.from !== startPointId
    )
  );

  return {
    ...deck,
    flow: {
      ...deck.flow,
      startPoints: Object.keys(remainingStartPoints).length > 0 ? remainingStartPoints : undefined,
      edges: remainingEdges,
    },
  };
}

// ============================================================================
// Flow Settings Mutations
// ============================================================================

export interface UpdateFlowSettingsOptions {
  defaultTransition?: TransitionType;
  defaultTransitionDuration?: number;
}

/**
 * Update flow-level settings (default transitions)
 */
export function updateFlowSettings(deck: Deck, updates: UpdateFlowSettingsOptions): Deck {
  const updatedFlow = { ...deck.flow };

  if (updates.defaultTransition !== undefined) {
    updatedFlow.defaultTransition = updates.defaultTransition;
  }
  if (updates.defaultTransitionDuration !== undefined) {
    updatedFlow.defaultTransitionDuration = updates.defaultTransitionDuration;
  }

  return {
    ...deck,
    flow: updatedFlow,
  };
}

// ============================================================================
// Deck Settings Mutations
// ============================================================================

export interface UpdateDeckSettingsOptions {
  title?: string;
  description?: string;
  aspectRatio?: AspectRatio;
  gridColumns?: number;
  defaultBackdropSlideId?: string | null; // null to clear
  defaultStartPointId?: string | null; // null to clear
}

/**
 * Update deck-level settings (title, aspect ratio, grid columns, default backdrop)
 */
export function updateDeckSettings(deck: Deck, updates: UpdateDeckSettingsOptions): Deck {
  const updatedDeck = { ...deck };

  if (updates.title !== undefined) {
    updatedDeck.meta = {
      ...deck.meta,
      title: updates.title,
      updated: new Date().toISOString(),
    };
  }
  if (updates.description !== undefined) {
    updatedDeck.meta = {
      ...updatedDeck.meta,
      description: updates.description,
      updated: new Date().toISOString(),
    };
  }
  if (updates.aspectRatio !== undefined) {
    updatedDeck.aspectRatio = updates.aspectRatio;
  }
  if (updates.gridColumns !== undefined) {
    if (updates.gridColumns < 1 || updates.gridColumns > 12) {
      throw new Error('gridColumns must be between 1 and 12');
    }
    updatedDeck.gridColumns = updates.gridColumns;
  }
  if (updates.defaultBackdropSlideId !== undefined) {
    if (updates.defaultBackdropSlideId === null) {
      delete updatedDeck.defaultBackdropSlideId;
    } else {
      if (!deck.slides[updates.defaultBackdropSlideId]) {
        throw new Error(`Slide ${updates.defaultBackdropSlideId} not found`);
      }
      updatedDeck.defaultBackdropSlideId = updates.defaultBackdropSlideId;
    }
  }
  if (updates.defaultStartPointId !== undefined) {
    if (updates.defaultStartPointId === null) {
      delete updatedDeck.defaultStartPointId;
    } else {
      if (!deck.flow.startPoints?.[updates.defaultStartPointId]) {
        throw new Error(`Start point ${updates.defaultStartPointId} not found`);
      }
      updatedDeck.defaultStartPointId = updates.defaultStartPointId;
    }
  }

  return updatedDeck;
}

// ============================================================================
// Theme Mutations
// ============================================================================

export type ThemeTokenUpdates = Partial<StandardTokens>;

/**
 * Update theme tokens
 */
export function updateTheme(deck: Deck, tokenUpdates: ThemeTokenUpdates): Deck {
  return {
    ...deck,
    theme: {
      ...deck.theme,
      tokens: {
        ...deck.theme.tokens,
        ...tokenUpdates,
      },
    },
  };
}

/**
 * Update custom theme tokens (deck-specific tokens)
 */
export function updateCustomThemeTokens(
  deck: Deck,
  customTokens: Record<string, string>
): Deck {
  return {
    ...deck,
    theme: {
      ...deck.theme,
      customTokens: {
        ...deck.theme.customTokens,
        ...customTokens,
      },
    },
  };
}

// ============================================================================
// Slide Position Mutations
// ============================================================================

/**
 * Move a slide to a new position on the canvas
 */
export function moveSlide(
  deck: Deck,
  slideId: string,
  position: { x: number; y: number }
): Deck {
  const slide = deck.slides[slideId];
  if (!slide) {
    throw new Error(`Slide ${slideId} not found`);
  }

  return {
    ...deck,
    slides: {
      ...deck.slides,
      [slideId]: {
        ...slide,
        position,
      },
    },
  };
}

export interface MoveComponentOptions {
  newIndex: number;
  newParentId?: string | null; // null = move to root, string = move into container, undefined = no change
}

/**
 * Move a component to a new position within a slide, optionally changing parent
 */
export function moveComponent(
  deck: Deck,
  slideId: string,
  componentId: string,
  options: number | MoveComponentOptions // Support legacy number arg or new options object
): Deck {
  const slide = deck.slides[slideId];
  if (!slide) {
    throw new Error(`Slide ${slideId} not found`);
  }

  const componentIndex = slide.components.findIndex(c => c.id === componentId);
  if (componentIndex === -1) {
    throw new Error(`Component ${componentId} not found in slide ${slideId}`);
  }

  // Normalize options
  const opts: MoveComponentOptions = typeof options === 'number' 
    ? { newIndex: options } 
    : options;

  const component = slide.components[componentIndex];

  // Validate parent change if requested
  if (opts.newParentId !== undefined) {
    if (opts.newParentId !== null) {
      const parentComponent = slide.components.find(c => c.id === opts.newParentId);
      if (!parentComponent) {
        throw new Error(`Parent container ${opts.newParentId} not found in slide ${slideId}`);
      }
      if (parentComponent.type !== 'deck-container') {
        throw new Error(`Parent ${opts.newParentId} is not a container`);
      }
      // Prevent moving containers into containers
      if (component.type === 'deck-container') {
        throw new Error('Containers cannot be nested inside other containers');
      }
      // Prevent moving component into itself
      if (opts.newParentId === componentId) {
        throw new Error('Cannot move component into itself');
      }
    }
  }

  // Clamp new index to valid range
  const clampedIndex = Math.max(0, Math.min(opts.newIndex, slide.components.length - 1));
  
  // Check if anything changes
  const parentIdChanged = opts.newParentId !== undefined && 
    (opts.newParentId === null ? component.parentId !== undefined : component.parentId !== opts.newParentId);
  const indexChanged = clampedIndex !== componentIndex;
  
  if (!parentIdChanged && !indexChanged) {
    return deck; // No change needed
  }

  const components = [...slide.components];
  const [movedComponent] = components.splice(componentIndex, 1);
  
  // Update parentId if requested
  let updatedComponent = movedComponent;
  if (opts.newParentId !== undefined) {
    if (opts.newParentId === null) {
      // Remove parentId
      const { parentId: _, ...rest } = movedComponent;
      updatedComponent = rest as Component;
    } else {
      // Set new parentId
      updatedComponent = { ...movedComponent, parentId: opts.newParentId } as Component;
    }
  }
  
  components.splice(clampedIndex, 0, updatedComponent);

  return {
    ...deck,
    slides: {
      ...deck.slides,
      [slideId]: {
        ...slide,
        components,
      },
    },
  };
}
