/**
 * Auto-generated component documentation for LLM prompts.
 *
 * Extracts property info from Zod schemas so that adding a new component
 * schema automatically includes it in the LLM's system prompt.
 * Descriptions and usage tips are the only manual additions.
 */

import { z } from 'zod';
import {
  TextComponentSchema,
  ImageComponentSchema,
  ContainerComponentSchema,
  DiagramComponentSchema,
} from './component.js';

/**
 * Manual metadata per component — descriptions and usage tips that
 * can't be derived from the Zod schema alone.
 */
interface ComponentDocMeta {
  description: string;
  tips?: string[];
  /** Per-property descriptions (supplements the auto-extracted type info) */
  propDescriptions?: Record<string, string>;
}

const componentDocMeta: Record<string, ComponentDocMeta> = {
  'deck-text': {
    description: 'Universal text block — plain or markdown.',
    tips: [
      'For headings, use size="display" or "2xl" with weight="bold"',
      'For lists, use markdown=true with content like "- Item 1\\n- Item 2"',
      'For simple body text, just set content (no markdown flag needed)',
    ],
    propDescriptions: {
      content: 'text content',
      markdown: 'opt-in for GH-flavored markdown rendering; default false',
      size: 'text size preset',
      weight: 'font weight',
      align: 'text alignment',
      transform: 'text transform',
      color: 'CSS color string',
      gridWidth: 'columns to span (0 = full width)',
    },
  },
  'deck-image': {
    description: 'Image from assets.',
    propDescriptions: {
      assetId: 'asset ID (required)',
      fit: 'object-fit mode',
      darken: '0-100 darkening overlay',
      blur: '0-20px blur',
      maxWidth: 'max width in px',
      maxHeight: 'max height in px',
      align: 'horizontal alignment',
      color: 'hex color for SVG fill',
      gridWidth: 'columns to span (0 = full width)',
    },
  },
  'deck-container': {
    description: 'Groups components in a sub-grid or floating layer.',
    tips: [
      'To add components inside a container, use the parentId parameter when calling add_component',
      'Containers CANNOT be nested inside other containers (max 2 levels: slide → container → components)',
      'Children inherit the container\'s internal grid',
      'A container is floating when anchorX or anchorY is set',
    ],
    propDescriptions: {
      gridWidth: 'columns to span AND internal columns (required, 1-12)',
      background: 'background color',
      padding: 'internal padding',
      gap: 'gap between children',
      alignItems: 'vertical alignment of children',
      justifyContent: 'horizontal distribution of children',
      anchorX: 'horizontal anchor for floating mode',
      anchorY: 'vertical anchor for floating mode',
      x: 'offset from anchor (e.g., "20px" or "5%")',
      y: 'offset from anchor',
      width: 'container width (e.g., "200px", "25%")',
      height: 'container height',
      opacity: '0-100 opacity',
    },
  },
  'deck-diagram': {
    description: 'Renders Mermaid syntax as SVG diagram.',
    tips: [
      'Source should be valid Mermaid syntax (flowchart, sequence, ER, etc.)',
      'The "auto" theme (default) inherits colors from the deck theme',
    ],
    propDescriptions: {
      source: 'Mermaid diagram syntax (required)',
      theme: 'Mermaid theme — "auto" inherits deck colors',
      gridWidth: 'columns to span (0 = full width)',
    },
  },
};

/**
 * Shared visual props description (used by image and container).
 */
const visualPropsDescription: Record<string, string> = {
  borderRadius: 'border radius preset',
  borderWidth: '0-10 border width',
  borderColor: 'CSS border color',
  shadow: 'shadow preset',
  shadowColor: 'CSS shadow color',
};

/**
 * Map of component type → Zod schema for props extraction.
 */
const componentSchemas: Record<string, z.ZodObject<any>> = {
  'deck-text': TextComponentSchema,
  'deck-image': ImageComponentSchema,
  'deck-container': ContainerComponentSchema,
  'deck-diagram': DiagramComponentSchema,
};

/**
 * Extract type info from a Zod schema field.
 */
function getZodTypeInfo(schema: z.ZodTypeAny): { type: string; required: boolean } {
  let current = schema;
  let required = true;

  // Unwrap optional
  if (current._def.typeName === 'ZodOptional') {
    required = false;
    current = current._def.innerType;
  }

  // Unwrap default
  if (current._def.typeName === 'ZodDefault') {
    current = current._def.innerType;
  }

  switch (current._def.typeName) {
    case 'ZodString':
      return { type: 'string', required };
    case 'ZodNumber':
      return { type: 'number', required };
    case 'ZodBoolean':
      return { type: 'boolean', required };
    case 'ZodEnum':
      return { type: (current as z.ZodEnum<any>).options.map((v: string) => `"${v}"`).join('|'), required };
    case 'ZodLiteral':
      return { type: JSON.stringify(current._def.value), required };
    default:
      return { type: 'any', required };
  }
}

/**
 * Generate the Component Types documentation section for LLM prompts.
 * Auto-extracts props from Zod schemas, enriched with manual descriptions.
 */
export function generateComponentDocs(): string {
  return Object.entries(componentSchemas).map(([type, schema]) => {
    const meta = componentDocMeta[type];
    const propsSchema = schema.shape.props as z.ZodObject<any>;
    const propsShape = propsSchema.shape;

    // Build props list
    const propsLines = Object.entries(propsShape).map(([name, fieldSchema]) => {
      const info = getZodTypeInfo(fieldSchema as z.ZodTypeAny);
      const desc = meta?.propDescriptions?.[name] || visualPropsDescription[name] || '';
      const reqMarker = info.required ? ', required' : '';
      return `  ${name} (${info.type}${reqMarker})${desc ? ` — ${desc}` : ''}`;
    });

    // Build component section
    const header = `- **${type}**: ${meta?.description || ''}`;
    const props = `  Props:\n${propsLines.join('\n')}`;
    const tips = meta?.tips?.length
      ? meta.tips.map(t => `  - ${t}`).join('\n')
      : '';

    return [header, props, tips].filter(Boolean).join('\n');
  }).join('\n\n');
}
