import { z } from 'zod';
import { SlideSchema, SlidesMapSchema, PositionSchema } from './slide';
import { ThemeSchema, defaultTheme } from './theme';

/**
 * Deck metadata
 */
export const DeckMetaSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  created: z.string().datetime(),
  updated: z.string().datetime(),
});

export type DeckMeta = z.infer<typeof DeckMetaSchema>;

/**
 * Transition types for slide navigation
 */
export const TransitionTypeSchema = z.enum([
  'instant',           // No animation (default)
  'slide-left',        // New slide enters from right
  'slide-right',       // New slide enters from left
  'slide-up',          // New slide enters from bottom
  'slide-down',        // New slide enters from top
  'cross-fade',        // Simultaneous fade out/in
  'fade-through-black', // Fade to black, then fade in
]);

export type TransitionType = z.infer<typeof TransitionTypeSchema>;

/**
 * Edge trigger types
 */
export const EdgeTriggerSchema = z.union([
  z.literal('default'), // Linear navigation (next)
  z.string().regex(/^button:/, 'Button trigger must start with "button:"'), // e.g., "button:learn-more"
]);

export type EdgeTrigger = z.infer<typeof EdgeTriggerSchema>;

/**
 * Navigation edge between slides (or from start point to slide)
 */
export const EdgeSchema = z.object({
  id: z.string(),
  from: z.string(), // Slide ID or StartPoint ID
  to: z.string(), // Slide ID
  trigger: EdgeTriggerSchema,
  sourceHandle: z.string().optional(),                // e.g. 'source-right', 'source-bottom'
  targetHandle: z.string().optional(),                // e.g. 'target-left', 'target-top'
  label: z.string().optional(),
  transition: TransitionTypeSchema.optional(),        // Overrides deck default
  transitionDuration: z.number().min(0).optional(),   // Seconds, overrides deck default
});

export type Edge = z.infer<typeof EdgeSchema>;

/**
 * Start point - named entry point for presentations
 */
export const StartPointSchema = z.object({
  id: z.string(),
  name: z.string().max(50),
  position: PositionSchema, // Canvas position
});

export type StartPoint = z.infer<typeof StartPointSchema>;

/**
 * Start points map
 */
export const StartPointsMapSchema = z.record(z.string(), StartPointSchema);

export type StartPointsMap = z.infer<typeof StartPointsMapSchema>;

/**
 * Flow definition - edges, start points, and transition defaults
 */
export const FlowSchema = z.object({
  edges: z.record(z.string(), EdgeSchema),
  startPoints: StartPointsMapSchema.optional(),
  defaultTransition: TransitionTypeSchema.optional(),     // Defaults to 'instant'
  defaultTransitionDuration: z.number().min(0).optional(), // Seconds, defaults to 0.3
});

export type Flow = z.infer<typeof FlowSchema>;

/**
 * Slide aspect ratio
 */
export const AspectRatioSchema = z.enum(['16:9', '4:3', '16:10']);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

/**
 * Default grid columns for slides
 */
export const DEFAULT_GRID_COLUMNS = 8;

/**
 * Slide dimensions based on aspect ratio (width is always 800)
 */
export const SLIDE_WIDTH = 800;
export const SLIDE_HEIGHTS: Record<AspectRatio, number> = {
  '16:9': 450,
  '4:3': 600,
  '16:10': 500,
};

export function getSlideHeight(aspectRatio: AspectRatio): number {
  return SLIDE_HEIGHTS[aspectRatio];
}

/**
 * Asset metadata
 */
export const AssetSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  url: z.string(),
  uploaded: z.string().datetime(),
});

export type Asset = z.infer<typeof AssetSchema>;

/**
 * Assets map
 */
export const AssetsMapSchema = z.record(z.string(), AssetSchema);

export type AssetsMap = z.infer<typeof AssetsMapSchema>;

/**
 * Complete deck document
 */
export const DeckSchema = z.object({
  meta: DeckMetaSchema,
  theme: ThemeSchema,
  aspectRatio: AspectRatioSchema.default('16:9'),
  gridColumns: z.number().min(1).max(12).default(DEFAULT_GRID_COLUMNS),
  defaultBackdropSlideId: z.string().optional(), // Default backdrop slide for all slides
  defaultStartPointId: z.string().optional(), // Default start point for presentations/thumbnails
  slides: SlidesMapSchema,
  flow: FlowSchema,
  assets: AssetsMapSchema.optional(),
});

export type Deck = z.infer<typeof DeckSchema>;

/**
 * Generate a new deck ID
 */
export function generateDeckId(): string {
  return `deck-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Generate a new edge ID
 */
export function generateEdgeId(): string {
  return `edge-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Generate a new start point ID
 */
export function generateStartPointId(): string {
  return `start-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Create a new start point
 */
export function createStartPoint(
  name: string,
  position: { x: number; y: number } = { x: 0, y: 0 }
): StartPoint {
  return {
    id: generateStartPointId(),
    name,
    position,
  };
}

/**
 * Default transition duration in seconds
 */
export const DEFAULT_TRANSITION_DURATION = 0.3;

/**
 * Create a new empty deck
 */
export function createEmptyDeck(title: string = 'Untitled Deck'): Deck {
  const now = new Date().toISOString();
  const deckId = generateDeckId();
  const slideId = `slide-${crypto.randomUUID().slice(0, 8)}`;

  return {
    meta: {
      id: deckId,
      title,
      created: now,
      updated: now,
    },
    theme: defaultTheme,
    aspectRatio: '16:9',
    gridColumns: DEFAULT_GRID_COLUMNS,
    slides: {
      [slideId]: {
        id: slideId,
        title: 'Title Slide',
        components: [
          {
            id: `comp-${crypto.randomUUID().slice(0, 8)}`,
            type: 'deck-title',
            props: { text: title, level: '1' },
          },
        ],
        position: { x: 0, y: 0 },
      },
    },
    flow: {
      edges: {},
    },
    assets: {},
  };
}

/**
 * Validate a deck document
 */
export function validateDeck(data: unknown): { success: true; data: Deck } | { success: false; errors: z.ZodError } {
  const result = DeckSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Get the cover slide ID for a deck.
 * Priority:
 * 1. Default start point's first edge target
 * 2. Any start point's first edge target
 * 3. First slide by position (top-left)
 */
export function getCoverSlideId(deck: Deck): string | null {
  const edges = Object.values(deck.flow.edges);
  const slides = Object.values(deck.slides);
  
  if (slides.length === 0) return null;

  // 1. Try default start point
  if (deck.defaultStartPointId) {
    const edge = edges.find(e => e.from === deck.defaultStartPointId);
    if (edge && deck.slides[edge.to]) {
      return edge.to;
    }
  }

  // 2. Try any start point
  const startPoints = Object.keys(deck.flow.startPoints ?? {});
  for (const spId of startPoints) {
    const edge = edges.find(e => e.from === spId);
    if (edge && deck.slides[edge.to]) {
      return edge.to;
    }
  }

  // 3. Fall back to first slide by position (top-left = min x, then min y)
  const sortedSlides = [...slides].sort((a, b) => {
    if (a.position.x !== b.position.x) return a.position.x - b.position.x;
    return a.position.y - b.position.y;
  });
  
  return sortedSlides[0]?.id ?? null;
}
