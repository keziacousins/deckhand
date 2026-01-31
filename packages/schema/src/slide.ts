import { z } from 'zod';
import { ComponentSchema } from './component';

/**
 * Position on the canvas
 */
export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type Position = z.infer<typeof PositionSchema>;

/**
 * Margin/padding specification
 */
export const SpacingSchema = z.object({
  top: z.string().optional(),
  right: z.string().optional(),
  bottom: z.string().optional(),
  left: z.string().optional(),
});

export type Spacing = z.infer<typeof SpacingSchema>;

/**
 * Grid configuration for component placement
 */
export const GridSchema = z.object({
  columns: z.number().default(12),
  rows: z.number().optional(),
  gap: z.string().optional(),
  rowGap: z.string().optional(),
  columnGap: z.string().optional(),
});

export type Grid = z.infer<typeof GridSchema>;

/**
 * Slide layout configuration
 */
export const SlideLayoutSchema = z.object({
  // Content margins (inset from slide edges)
  margin: SpacingSchema.optional(),
  
  // Padding inside the content area
  padding: SpacingSchema.optional(),

  // Grid for component placement
  grid: GridSchema.optional(),

  // Content alignment within the slide
  alignItems: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  justifyContent: z.enum(['start', 'center', 'end', 'stretch', 'space-between', 'space-around']).optional(),
  
  // Content flow direction
  direction: z.enum(['column', 'row']).optional(),
  
  // Gap between components (if not using grid)
  gap: z.string().optional(),

  // Background (can override theme)
  backgroundColor: z.string().optional(),
  backgroundImage: z.string().optional(),
  backgroundSize: z.enum(['cover', 'contain', 'auto']).optional(),
  backgroundPosition: z.string().optional(),
});

export type SlideLayout = z.infer<typeof SlideLayoutSchema>;

/**
 * Default slide layout
 */
export const defaultSlideLayout: SlideLayout = {
  margin: {
    top: 'var(--deck-space-xl)',
    right: 'var(--deck-space-xl)',
    bottom: 'var(--deck-space-xl)',
    left: 'var(--deck-space-xl)',
  },
  alignItems: 'start',
  justifyContent: 'start',
  direction: 'column',
  gap: 'var(--deck-space-lg)',
};

/**
 * Slide definition
 */
export const SlideSchema = z.object({
  id: z.string(),
  title: z.string(),
  layout: SlideLayoutSchema.optional(),
  gridColumns: z.number().min(1).max(12).optional(), // Override deck default
  components: z.array(ComponentSchema),
  position: PositionSchema,
  notes: z.string().optional(),
});

export type Slide = z.infer<typeof SlideSchema>;

/**
 * Slides are stored as a map keyed by ID
 */
export const SlidesMapSchema = z.record(z.string(), SlideSchema);

export type SlidesMap = z.infer<typeof SlidesMapSchema>;

/**
 * Generate a new slide ID
 */
export function generateSlideId(): string {
  return `slide-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Create a blank slide
 */
export function createBlankSlide(position: Position = { x: 0, y: 0 }): Slide {
  return {
    id: generateSlideId(),
    title: 'Untitled',
    layout: defaultSlideLayout,
    components: [],
    position,
  };
}

/**
 * Convert slide layout to CSS properties for the slide container.
 */
export function layoutToCssProperties(layout: SlideLayout): Record<string, string> {
  const props: Record<string, string> = {};

  // Margins
  if (layout.margin) {
    if (layout.margin.top) props['padding-top'] = layout.margin.top;
    if (layout.margin.right) props['padding-right'] = layout.margin.right;
    if (layout.margin.bottom) props['padding-bottom'] = layout.margin.bottom;
    if (layout.margin.left) props['padding-left'] = layout.margin.left;
  }

  // Flexbox layout
  props['display'] = 'flex';
  props['flex-direction'] = layout.direction || 'column';
  
  if (layout.alignItems) props['align-items'] = layout.alignItems;
  if (layout.justifyContent) props['justify-content'] = layout.justifyContent;
  if (layout.gap) props['gap'] = layout.gap;

  // Background
  if (layout.backgroundColor) props['background-color'] = layout.backgroundColor;
  if (layout.backgroundImage) props['background-image'] = `url(${layout.backgroundImage})`;
  if (layout.backgroundSize) props['background-size'] = layout.backgroundSize;
  if (layout.backgroundPosition) props['background-position'] = layout.backgroundPosition;

  return props;
}
