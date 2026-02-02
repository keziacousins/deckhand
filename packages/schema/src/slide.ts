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
 * Background size options for slide background images
 * - 'fill': Zoom to fill the slide (may crop) - maps to CSS 'cover'
 * - 'fit-width': Fit to slide width (may have vertical gaps) - maps to CSS '100% auto'
 * - 'fit-height': Fit to slide height (may have horizontal gaps) - maps to CSS 'auto 100%'
 */
export const BackgroundSizeSchema = z.enum(['fill', 'fit-width', 'fit-height']);

export type BackgroundSize = z.infer<typeof BackgroundSizeSchema>;

/**
 * Slide style overrides - override theme tokens per slide
 */
export const SlideStyleSchema = z.object({
  // Color overrides
  background: z.string().optional(),
  textPrimary: z.string().optional(),
  textSecondary: z.string().optional(),
  accent: z.string().optional(),
  
  // Background image (references deck.assets by ID)
  backgroundAssetId: z.string().optional(),
  backgroundSize: BackgroundSizeSchema.optional(),
  backgroundPosition: z.string().optional(),
  backgroundDarken: z.number().min(0).max(100).optional(), // 0-100%
  backgroundBlur: z.number().min(0).max(20).optional(), // 0-20px
  backgroundTransparent: z.boolean().optional(), // true = no background, allows backdrop to show through
  
  // Backdrop slide (renders behind this slide's content)
  backdropSlideId: z.string().optional(),
});

export type SlideStyle = z.infer<typeof SlideStyleSchema>;

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
  style: SlideStyleSchema.optional(),
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

  return props;
}

/**
 * Map background size values to CSS background-size property values.
 */
export function backgroundSizeToCss(size: BackgroundSize): string {
  switch (size) {
    case 'fill':
      return 'cover';
    case 'fit-width':
      return '100% auto';
    case 'fit-height':
      return 'auto 100%';
  }
}

/**
 * Convert slide style to CSS custom properties (theme token overrides).
 */
export function styleToCssProperties(style: SlideStyle): Record<string, string> {
  const props: Record<string, string> = {};

  // Color overrides - map to theme token CSS variables
  if (style.background) props['--deck-color-background'] = style.background;
  if (style.textPrimary) props['--deck-color-text-primary'] = style.textPrimary;
  if (style.textSecondary) props['--deck-color-text-secondary'] = style.textSecondary;
  if (style.accent) props['--deck-color-accent'] = style.accent;

  // Note: backgroundAssetId is resolved to URL at the component level (deck-slide)
  // since it requires access to the deck's assets map
  if (style.backgroundSize) props['background-size'] = backgroundSizeToCss(style.backgroundSize);
  if (style.backgroundPosition) props['background-position'] = style.backgroundPosition;

  return props;
}
