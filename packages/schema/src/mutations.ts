/**
 * Domain mutation functions for Deck documents.
 * 
 * These pure functions take a Deck and return a new Deck with the mutation applied.
 * They are used by both the frontend and LLM tools to ensure consistent behavior.
 */

import type { Deck, Slide, Component, SlideStyle, Edge, StartPoint, TransitionType, EdgeTrigger, AspectRatio, StandardTokens } from './index';

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
  
  // Find rightmost slide and place new one to the right
  const maxX = Math.max(...slides.map(s => s.position.x));
  return { x: maxX + 300, y: 0 };
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

  const componentId = generateId('comp');
  const newComponent: Component = {
    id: componentId,
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
 * Delete a component from a slide
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

  const components = slide.components.filter(c => c.id !== componentId);

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
  
  // Validate that 'from' exists (slide or start point)
  const fromIsSlide = deck.slides[options.from] !== undefined;
  const fromIsStartPoint = deck.flow.startPoints?.[options.from] !== undefined;
  
  if (!fromIsSlide && !fromIsStartPoint) {
    throw new Error(`Source ${options.from} not found (must be a slide or start point)`);
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

/**
 * Move a component to a new position within a slide
 */
export function moveComponent(
  deck: Deck,
  slideId: string,
  componentId: string,
  newIndex: number
): Deck {
  const slide = deck.slides[slideId];
  if (!slide) {
    throw new Error(`Slide ${slideId} not found`);
  }

  const componentIndex = slide.components.findIndex(c => c.id === componentId);
  if (componentIndex === -1) {
    throw new Error(`Component ${componentId} not found in slide ${slideId}`);
  }

  // Clamp new index to valid range
  const clampedIndex = Math.max(0, Math.min(newIndex, slide.components.length - 1));
  
  if (clampedIndex === componentIndex) {
    return deck; // No change needed
  }

  const components = [...slide.components];
  const [component] = components.splice(componentIndex, 1);
  components.splice(clampedIndex, 0, component);

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
