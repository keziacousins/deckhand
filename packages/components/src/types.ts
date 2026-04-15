/**
 * Component metadata types for self-describing components.
 * 
 * Components declare their properties and the inspector auto-generates
 * appropriate editors based on these declarations.
 */

/**
 * Property types that the inspector knows how to edit
 */
export type PropertyType =
  | 'string'      // Single-line text input
  | 'text'        // Multi-line textarea
  | 'number'      // Numeric input
  | 'boolean'     // Toggle/checkbox
  | 'enum'        // Dropdown select
  | 'color'       // Color picker
  | 'richtext'    // Rich text editor
  | 'asset'       // Asset picker (images, etc.)
  | 'spacing'     // Spacing input (margin/padding)
  | 'alignment';  // Alignment picker

/**
 * Property descriptor - describes a single editable property
 */
export interface PropertyDescriptor {
  /** Property type determines which editor to use */
  type: PropertyType;
  
  /** Human-readable label shown in inspector */
  label: string;
  
  /** Optional description/tooltip */
  description?: string;
  
  /** Default value if not set */
  default?: unknown;
  
  /** Options for 'enum' type */
  options?: Array<{ value: string; label: string }> | string[];
  
  /** Whether this property is required */
  required?: boolean;
  
  /** Group name for organizing in inspector (e.g., "Layout", "Style") */
  group?: string;
  
  /** Placeholder text for inputs */
  placeholder?: string;
  
  /** For number type: min/max/step */
  min?: number;
  max?: number;
  step?: number;
  
  /** For asset type: allowed mime types */
  accept?: string[];
  
  /** Whether this field can share a row with another compact field in the inspector */
  compact?: boolean;
}

/**
 * Component category for organization
 */
export type ComponentCategory = 
  | 'content'     // Text, titles, quotes, etc.
  | 'layout'      // Columns, grids, spacers
  | 'media'       // Images, video, embeds
  | 'interactive' // Buttons, forms, CTAs
  | 'data';       // Charts, tables, stats

/**
 * Component metadata - declares everything the editor needs to know
 */
export interface ComponentMeta {
  /** Unique component type identifier (e.g., 'deck-hero') */
  type: string;
  
  /** Human-readable name (e.g., 'Hero Section') */
  name: string;
  
  /** Brief description of what the component does */
  description: string;
  
  /** Category for organization in component picker */
  category: ComponentCategory;
  
  /** Icon identifier or inline SVG */
  icon?: string;
  
  /** Property definitions keyed by prop name */
  properties: Record<string, PropertyDescriptor>;
  
  /** Custom tokens this component requires (deck should define these) */
  requiredTokens?: string[];
  
  /** Preview/thumbnail generation hints */
  preview?: {
    /** Minimum content to show in preview */
    sampleProps?: Record<string, unknown>;
  };
}


/**
 * Standard property groups
 */
export const PropertyGroups = {
  CONTENT: 'Content',
  LAYOUT: 'Layout',
  STYLE: 'Style',
  ADVANCED: 'Advanced',
} as const;

/**
 * Common property descriptors for reuse
 */
export const CommonProperties = {
  text: (label = 'Text', required = false): PropertyDescriptor => ({
    type: 'string',
    label,
    required,
    group: PropertyGroups.CONTENT,
  }),
  
  richText: (label = 'Content'): PropertyDescriptor => ({
    type: 'richtext',
    label,
    group: PropertyGroups.CONTENT,
  }),
  
  alignment: (label = 'Alignment', defaultValue = 'left'): PropertyDescriptor => ({
    type: 'enum',
    label,
    options: [
      { value: 'left', label: 'Left' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right' },
    ],
    default: defaultValue,
    group: PropertyGroups.LAYOUT,
  }),
  
  color: (label: string, defaultValue?: string): PropertyDescriptor => ({
    type: 'color',
    label,
    default: defaultValue,
    group: PropertyGroups.STYLE,
  }),
  
  spacing: (label: string): PropertyDescriptor => ({
    type: 'spacing',
    label,
    group: PropertyGroups.LAYOUT,
  }),
  
  asset: (label = 'Image', accept = ['image/*']): PropertyDescriptor => ({
    type: 'asset',
    label,
    accept,
    group: PropertyGroups.CONTENT,
  }),

  gridWidth: (maxColumns = 12): PropertyDescriptor => ({
    type: 'number',
    label: 'Grid Width',
    description: 'Number of columns this component spans (0 = full width)',
    min: 0,
    max: maxColumns,
    step: 1,
    group: PropertyGroups.LAYOUT,
  }),

  borderRadius: (): PropertyDescriptor => ({
    type: 'enum',
    label: 'Radius',
    options: [
      { value: 'none', label: 'None' },
      { value: 'sm', label: 'Small' },
      { value: 'md', label: 'Medium' },
      { value: 'lg', label: 'Large' },
      { value: 'full', label: 'Circle' },
      { value: 'pill', label: 'Pill' },
    ],
    default: 'none',
    group: PropertyGroups.STYLE,
  }),

  borderWidth: (): PropertyDescriptor => ({
    type: 'number',
    label: 'Border',
    min: 0,
    max: 10,
    step: 1,
    default: 0,
    group: PropertyGroups.STYLE,
    compact: true,
  }),

  borderColor: (): PropertyDescriptor => ({
    type: 'color',
    label: 'Border Color',
    group: PropertyGroups.STYLE,
    compact: true,
  }),

  shadow: (): PropertyDescriptor => ({
    type: 'enum',
    label: 'Shadow',
    options: [
      { value: 'none', label: 'None' },
      { value: 'sm', label: 'Small' },
      { value: 'md', label: 'Medium' },
      { value: 'lg', label: 'Large' },
    ],
    default: 'none',
    group: PropertyGroups.STYLE,
    compact: true,
  }),

  shadowColor: (): PropertyDescriptor => ({
    type: 'color',
    label: 'Shadow Color',
    group: PropertyGroups.STYLE,
    compact: true,
  }),
};
