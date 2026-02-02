import { z } from 'zod';
import { RichTextSchema } from './richtext';

/**
 * Grid layout properties shared by all components
 */
const GridPropsSchema = z.object({
  gridWidth: z.number().min(1).max(12).optional(), // Number of columns to span
});

/**
 * Base component structure - all components have id and type
 */
const BaseComponentSchema = z.object({
  id: z.string(),
});

/**
 * Title component
 */
export const TitleComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-title'),
  props: GridPropsSchema.extend({
    text: z.string(),
    level: z.enum(['1', '2', '3']).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
  }),
});

/**
 * Subtitle component
 */
export const SubtitleComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-subtitle'),
  props: GridPropsSchema.extend({
    text: z.string(),
    align: z.enum(['left', 'center', 'right']).optional(),
  }),
});

/**
 * Text component with rich text support
 */
export const TextComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-text'),
  props: GridPropsSchema.extend({
    content: RichTextSchema,
    align: z.enum(['left', 'center', 'right']).optional(),
  }),
});

/**
 * List component
 */
export const ListComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-list'),
  props: GridPropsSchema.extend({
    items: z.array(z.string()),
    ordered: z.boolean().optional(),
  }),
});

/**
 * Image component
 */
export const ImageComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-image'),
  props: GridPropsSchema.extend({
    assetId: z.string(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    fit: z.enum(['contain', 'cover', 'fill']).optional(),
    darken: z.number().min(0).max(100).optional(),
    blur: z.number().min(0).max(20).optional(),
    maxHeight: z.number().min(0).max(1000).optional(),
  }),
});

/**
 * Floating image component - positioned at absolute coordinates
 * Rendered in a separate layer outside the slide's content padding
 */
export const FloatingImageComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-floating-image'),
  props: z.object({
    assetId: z.string(),
    alt: z.string().optional(),
    anchorX: z.enum(['left', 'right']).optional(), // Which horizontal edge to anchor to
    anchorY: z.enum(['top', 'bottom']).optional(), // Which vertical edge to anchor to
    x: z.string().optional(), // Horizontal offset (e.g., "20", "20px", "5%")
    y: z.string().optional(), // Vertical offset (e.g., "20", "20px", "5%")
    width: z.string().optional(), // Width (e.g., "200", "200px", "25%")
    height: z.string().optional(), // Height (e.g., "150", "150px", "20%")
    fit: z.enum(['contain', 'cover', 'fill']).optional(),
    opacity: z.number().min(0).max(100).optional(),
    borderRadius: z.number().min(0).optional(),
  }),
});

/**
 * Code component
 */
export const CodeComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-code'),
  props: GridPropsSchema.extend({
    code: z.string(),
    language: z.string().optional(),
    showLineNumbers: z.boolean().optional(),
  }),
});

/**
 * Quote component
 */
export const QuoteComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-quote'),
  props: GridPropsSchema.extend({
    text: z.string(),
    attribution: z.string().optional(),
  }),
});

/**
 * Columns layout component
 * Note: For simplicity, columns contain component IDs rather than nested components
 */
export const ColumnsComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-columns'),
  props: GridPropsSchema.extend({
    columns: z.array(z.object({
      id: z.string(),
      componentIds: z.array(z.string()), // References to other components
    })),
    gap: z.string().optional(),
  }),
});

/**
 * Spacer component
 */
export const SpacerComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-spacer'),
  props: GridPropsSchema.extend({
    height: z.string().optional(),
  }),
});

/**
 * Headline + Subhead component
 * A flexible headline with optional category label and subheading
 */
export const HeadlineSubheadComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-headline-subhead'),
  props: GridPropsSchema.extend({
    headline: z.string(),
    subheading: z.string().optional(),
    category: z.string().optional(),
    isHero: z.boolean().optional(),
    variant: z.enum(['dark', 'light']).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
  }),
});

/**
 * Union of all component types
 */
export const ComponentSchema = z.discriminatedUnion('type', [
  TitleComponentSchema,
  SubtitleComponentSchema,
  TextComponentSchema,
  ListComponentSchema,
  ImageComponentSchema,
  FloatingImageComponentSchema,
  CodeComponentSchema,
  QuoteComponentSchema,
  ColumnsComponentSchema,
  SpacerComponentSchema,
  HeadlineSubheadComponentSchema,
]);

export type TitleComponent = z.infer<typeof TitleComponentSchema>;
export type SubtitleComponent = z.infer<typeof SubtitleComponentSchema>;
export type TextComponent = z.infer<typeof TextComponentSchema>;
export type ListComponent = z.infer<typeof ListComponentSchema>;
export type ImageComponent = z.infer<typeof ImageComponentSchema>;
export type FloatingImageComponent = z.infer<typeof FloatingImageComponentSchema>;
export type CodeComponent = z.infer<typeof CodeComponentSchema>;
export type QuoteComponent = z.infer<typeof QuoteComponentSchema>;
export type ColumnsComponent = z.infer<typeof ColumnsComponentSchema>;
export type SpacerComponent = z.infer<typeof SpacerComponentSchema>;
export type HeadlineSubheadComponent = z.infer<typeof HeadlineSubheadComponentSchema>;

export type Component = z.infer<typeof ComponentSchema>;

/**
 * Component type names
 */
export const componentTypes = [
  'deck-title',
  'deck-subtitle',
  'deck-text',
  'deck-list',
  'deck-image',
  'deck-floating-image',
  'deck-code',
  'deck-quote',
  'deck-columns',
  'deck-spacer',
  'deck-headline-subhead',
] as const;

export type ComponentType = (typeof componentTypes)[number];
