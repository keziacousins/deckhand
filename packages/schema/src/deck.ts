import { z } from 'zod';
import { SlideSchema, SlidesMapSchema } from './slide';
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
 * Edge trigger types
 */
export const EdgeTriggerSchema = z.union([
  z.literal('default'), // Linear navigation (next)
  z.string().regex(/^button:/, 'Button trigger must start with "button:"'), // e.g., "button:learn-more"
]);

export type EdgeTrigger = z.infer<typeof EdgeTriggerSchema>;

/**
 * Navigation edge between slides
 */
export const EdgeSchema = z.object({
  id: z.string(),
  from: z.string(), // Slide ID
  to: z.string(), // Slide ID
  trigger: EdgeTriggerSchema,
  label: z.string().optional(),
});

export type Edge = z.infer<typeof EdgeSchema>;

/**
 * Flow definition - edges and entry point
 */
export const FlowSchema = z.object({
  edges: z.record(z.string(), EdgeSchema),
  entrySlide: z.string(),
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
      entrySlide: slideId,
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
