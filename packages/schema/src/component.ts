import { z } from 'zod';

/**
 * Grid layout properties shared by grid-flow components
 */
const GridPropsSchema = z.object({
  gridWidth: z.number().min(0).max(12).optional(), // Number of columns to span (0 = full width)
});

/**
 * Visual properties shared by image and container components
 */
export const VisualPropsSchema = z.object({
  borderRadius: z.enum(['none', 'sm', 'md', 'lg', 'full', 'pill']).optional(),
  borderWidth: z.number().min(0).max(10).optional(),
  borderColor: z.string().optional(),
  shadow: z.enum(['none', 'sm', 'md', 'lg']).optional(),
  shadowColor: z.string().optional(),
});

/**
 * Base component structure - all components have id and type
 */
const BaseComponentSchema = z.object({
  id: z.string(),
  parentId: z.string().optional(), // ID of parent container, if nested
});

/**
 * Text component — universal text primitive
 * 
 * Content is a plain string. When markdown=true, rendered as GH-flavored markdown.
 * Otherwise rendered as plain text.
 */
export const TextComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-text'),
  props: GridPropsSchema.extend({
    content: z.string(),
    markdown: z.boolean().optional(),
    tableStriped: z.boolean().optional(),
    size: z.enum(['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'display']).optional(),
    weight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    transform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
    color: z.string().optional(),
  }),
});

/**
 * Image component
 */
export const ImageComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-image'),
  props: GridPropsSchema.merge(VisualPropsSchema).extend({
    assetId: z.string(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    fit: z.enum(['contain', 'cover', 'fill']).optional(),
    darken: z.number().min(0).max(100).optional(),
    blur: z.number().min(0).max(20).optional(),
    maxWidth: z.number().min(0).max(2000).optional(),
    maxHeight: z.number().min(0).max(2000).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    color: z.string().optional(), // SVG fill color (works with currentColor SVGs)
  }),
});

/**
 * Container component — groups components in a sub-grid or floating layer
 * 
 * Grid mode (default): gridWidth determines both how many parent columns to span
 * AND how many internal columns are available for children.
 * 
 * Floating mode: when anchorX or anchorY is set, container is absolutely positioned
 * outside the normal content flow. Can hold any children (images, text, etc).
 * 
 * Note: Containers cannot be nested inside other containers (max 2 levels)
 */
export const ContainerComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-container'),
  props: VisualPropsSchema.extend({
    gridWidth: z.number().min(1).max(12), // Required: columns to span AND internal columns
    // Style options
    background: z.string().optional(),
    padding: z.enum(['none', 'sm', 'md', 'lg']).optional(),
    gap: z.enum(['none', 'sm', 'md', 'lg']).optional(),
    // Layout
    alignItems: z.enum(['start', 'center', 'end', 'stretch']).optional(),
    justifyContent: z.enum(['start', 'center', 'end', 'space-between']).optional(),
    // Floating mode (when anchorX or anchorY is set, container is absolutely positioned)
    anchorX: z.enum(['left', 'right']).optional(),
    anchorY: z.enum(['top', 'bottom']).optional(),
    x: z.string().optional(),       // Offset from anchor (e.g., "20", "20px", "5%")
    y: z.string().optional(),
    width: z.string().optional(),    // Container size (e.g., "200px", "25%")
    height: z.string().optional(),
    opacity: z.number().min(0).max(100).optional(),
  }),
});

/**
 * Diagram component — renders Mermaid syntax as SVG
 */
export const DiagramComponentSchema = BaseComponentSchema.extend({
  type: z.literal('deck-diagram'),
  props: GridPropsSchema.merge(VisualPropsSchema).extend({
    source: z.string(),
    theme: z.enum(['auto', 'default', 'dark', 'neutral', 'forest']).optional(),
    maxWidth: z.number().min(0).max(2000).optional(),
    maxHeight: z.number().min(0).max(2000).optional(),
  }),
});

/**
 * Union of all component types
 */
export const ComponentSchema = z.discriminatedUnion('type', [
  TextComponentSchema,
  ImageComponentSchema,
  ContainerComponentSchema,
  DiagramComponentSchema,
]);

export type VisualProps = z.infer<typeof VisualPropsSchema>;
export type TextComponent = z.infer<typeof TextComponentSchema>;
export type ImageComponent = z.infer<typeof ImageComponentSchema>;
export type ContainerComponent = z.infer<typeof ContainerComponentSchema>;
export type DiagramComponent = z.infer<typeof DiagramComponentSchema>;

export type Component = z.infer<typeof ComponentSchema>;

/**
 * Component type names
 */
export const componentTypes = [
  'deck-text',
  'deck-image',
  'deck-container',
  'deck-diagram',
] as const;

export type ComponentType = (typeof componentTypes)[number];
