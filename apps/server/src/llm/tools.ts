/**
 * LLM Tool definitions and execution for deck editing.
 * 
 * Tools use domain mutation functions from @deckhand/schema and
 * the sync layer from @deckhand/sync to apply changes to YDoc.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { Deck } from '@deckhand/schema';
import {
  addSlide,
  duplicateSlide,
  updateSlide,
  deleteSlide,
  addComponent,
  updateComponent,
  deleteComponent,
  addEdge,
  updateEdge,
  deleteEdge,
  addStartPoint,
  updateStartPoint,
  deleteStartPoint,
  updateFlowSettings,
  updateDeckSettings,
  updateTheme,
  moveSlide,
  moveComponent,
  type AddSlideOptions,
  type UpdateSlideOptions,
  type AddComponentOptions,
  type AddEdgeOptions,
  type UpdateEdgeOptions,
  type AddStartPointOptions,
  type UpdateStartPointOptions,
  type UpdateFlowSettingsOptions,
  type UpdateDeckSettingsOptions,
  type ThemeTokenUpdates,
  componentTypes,
  ComponentSchema,
} from '@deckhand/schema';
import { diffDeck, applyPatchesToYDoc } from '@deckhand/sync';
import * as Y from 'yjs';

/**
 * Tool definitions for Claude
 */
export const tools: Anthropic.Tool[] = [
  {
    name: 'update_slide',
    description: 'Update properties of a slide (title, notes, style, gridColumns)',
    input_schema: {
      type: 'object' as const,
      properties: {
        slideId: {
          type: 'string',
          description: 'The ID of the slide to update',
        },
        updates: {
          type: 'object',
          description: 'The properties to update',
          properties: {
            title: { type: 'string' },
            notes: { type: 'string' },
            gridColumns: { type: 'number' },
            style: {
              type: 'object',
              properties: {
                background: { type: 'string', description: 'Background color (hex)' },
                textPrimary: { type: 'string', description: 'Primary text color (hex)' },
                textSecondary: { type: 'string', description: 'Secondary text color (hex)' },
                accent: { type: 'string', description: 'Accent color (hex)' },
                backgroundAssetId: { type: 'string', description: 'Asset ID for background image' },
                backgroundSize: { type: 'string', enum: ['fill', 'fit-width', 'fit-height'] },
                backgroundDarken: { type: 'number', description: '0-100 percent' },
                backgroundBlur: { type: 'number', description: '0-20 pixels' },
                backgroundTransparent: { type: 'boolean', description: 'When true, slide has no background (transparent). Useful for backdrop slides that should let parent background show through.' },
                backdropSlideId: { type: 'string', description: 'ID of slide to render as backdrop behind this slide. Backdrop slides render with transparent background by default unless they have explicit background set.' },
              },
            },
          },
        },
      },
      required: ['slideId', 'updates'],
    },
  },
  {
    name: 'add_component',
    description: 'Add a new component to a slide, or inside a container. For deck-container, set gridWidth in props (1-12, determines span AND internal columns). Containers cannot be nested inside other containers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        slideId: {
          type: 'string',
          description: 'The ID of the slide to add the component to',
        },
        component: {
          type: 'object',
          description: 'The component to add',
          properties: {
            type: {
              type: 'string',
              enum: ['deck-text', 'deck-image', 'deck-container', 'deck-diagram'],
              description: 'The component type',
            },
            props: {
              type: 'object',
              description: 'Component properties (varies by type). For deck-text: content (string, required), markdown (boolean, opt-in for GH-flavored markdown), size (xs/sm/md/lg/xl/2xl/display), weight (normal/medium/semibold/bold), align (left/center/right), transform (none/uppercase/lowercase/capitalize), color (CSS color string), gridWidth (0-12, optional). For deck-image: assetId, alt, caption, fit (contain/cover/fill), darken (0-100), blur (0-20), maxWidth (px), maxHeight (px), align, color (SVG fill), gridWidth. For deck-container: gridWidth (required 1-12), background, padding (none/sm/md/lg), gap, alignItems, justifyContent. Floating mode: anchorX (left/right), anchorY (top/bottom), x, y, width, height (CSS values), opacity (0-100). For deck-diagram: source (string, required — Mermaid syntax), theme (auto/default/dark/neutral/forest, default auto — inherits slide colors), gridWidth. Visual props (image, container & diagram): borderRadius (none/sm/md/lg/full/pill), borderWidth (0-10), borderColor (CSS color), shadow (none/sm/md/lg), shadowColor (CSS color).',
            },
          },
          required: ['type', 'props'],
        },
        position: {
          type: 'number',
          description: 'Index position to insert at (optional, defaults to end)',
        },
        parentId: {
          type: 'string',
          description: 'ID of a deck-container to add this component inside. Cannot be used when adding deck-container (no nesting).',
        },
      },
      required: ['slideId', 'component'],
    },
  },
  {
    name: 'update_component',
    description: 'Update properties of an existing component',
    input_schema: {
      type: 'object' as const,
      properties: {
        slideId: {
          type: 'string',
          description: 'The ID of the slide containing the component',
        },
        componentId: {
          type: 'string',
          description: 'The ID of the component to update',
        },
        props: {
          type: 'object',
          description: 'The properties to update (merged with existing)',
        },
      },
      required: ['slideId', 'componentId', 'props'],
    },
  },
  {
    name: 'delete_component',
    description: 'Remove a component from a slide',
    input_schema: {
      type: 'object' as const,
      properties: {
        slideId: {
          type: 'string',
          description: 'The ID of the slide containing the component',
        },
        componentId: {
          type: 'string',
          description: 'The ID of the component to delete',
        },
      },
      required: ['slideId', 'componentId'],
    },
  },
  {
    name: 'add_slide',
    description: 'Add a new slide to the deck',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Title for the new slide',
        },
        afterSlideId: {
          type: 'string',
          description: 'ID of slide to insert after (optional, adds at end if not specified)',
        },
      },
      required: [],
    },
  },
  {
    name: 'duplicate_slide',
    description: 'Create a copy of an existing slide with all its components and styling. Edges are NOT copied — add them separately if needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        slideId: {
          type: 'string',
          description: 'The ID of the slide to duplicate',
        },
        title: {
          type: 'string',
          description: 'Optional custom title for the new slide (defaults to "Original Title (copy)")',
        },
      },
      required: ['slideId'],
    },
  },
  {
    name: 'get_flow_graph',
    description: 'Get the slide flow graph: all slides (with IDs and titles), edges (connections between slides with triggers and transitions), and start points. Use this to understand the presentation navigation structure before making flow changes.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'delete_slide',
    description: 'Remove a slide from the deck',
    input_schema: {
      type: 'object' as const,
      properties: {
        slideId: {
          type: 'string',
          description: 'The ID of the slide to delete',
        },
      },
      required: ['slideId'],
    },
  },
  // Edge tools
  {
    name: 'add_edge',
    description: 'Add a navigation connection. Source can be a slide, start point, or component (for clickable component links in presentation mode).',
    input_schema: {
      type: 'object' as const,
      properties: {
        from: {
          type: 'string',
          description: 'Source: slide ID, start point ID, or component ID (for component links)',
        },
        to: {
          type: 'string',
          description: 'Target slide ID',
        },
        trigger: {
          type: 'string',
          description: "Edge trigger: 'default' for linear navigation, or 'button:button-id' for button-triggered navigation",
        },
        label: {
          type: 'string',
          description: 'Optional label for the edge',
        },
        transition: {
          type: 'string',
          enum: ['instant', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'cross-fade', 'fade-through-black'],
          description: 'Transition animation for this edge (overrides deck default)',
        },
        transitionDuration: {
          type: 'number',
          description: 'Transition duration in seconds (overrides deck default)',
        },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'update_edge',
    description: 'Update properties of an existing edge connection',
    input_schema: {
      type: 'object' as const,
      properties: {
        edgeId: {
          type: 'string',
          description: 'The ID of the edge to update',
        },
        updates: {
          type: 'object',
          properties: {
            trigger: { type: 'string' },
            label: { type: 'string' },
            transition: {
              type: 'string',
              enum: ['instant', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'cross-fade', 'fade-through-black'],
            },
            transitionDuration: { type: 'number' },
          },
        },
      },
      required: ['edgeId', 'updates'],
    },
  },
  {
    name: 'delete_edge',
    description: 'Remove an edge connection',
    input_schema: {
      type: 'object' as const,
      properties: {
        edgeId: {
          type: 'string',
          description: 'The ID of the edge to delete',
        },
      },
      required: ['edgeId'],
    },
  },
  // Start point tools
  {
    name: 'add_start_point',
    description: 'Add a named entry point for presentations (e.g., "Sales Demo", "Technical Overview")',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Name of the start point (max 50 characters)',
        },
        connectToSlide: {
          type: 'string',
          description: 'Optionally connect to a slide immediately',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_start_point',
    description: 'Update a start point name or position',
    input_schema: {
      type: 'object' as const,
      properties: {
        startPointId: {
          type: 'string',
          description: 'The ID of the start point to update',
        },
        updates: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
      },
      required: ['startPointId', 'updates'],
    },
  },
  {
    name: 'delete_start_point',
    description: 'Remove a start point (also removes edges from it)',
    input_schema: {
      type: 'object' as const,
      properties: {
        startPointId: {
          type: 'string',
          description: 'The ID of the start point to delete',
        },
      },
      required: ['startPointId'],
    },
  },
  // Flow settings
  {
    name: 'update_flow_settings',
    description: 'Update deck-level flow settings like entry slide and default transitions',
    input_schema: {
      type: 'object' as const,
      properties: {
        defaultTransition: {
          type: 'string',
          enum: ['instant', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'cross-fade', 'fade-through-black'],
          description: 'Default transition for all edges',
        },
        defaultTransitionDuration: {
          type: 'number',
          description: 'Default transition duration in seconds',
        },
      },
      required: [],
    },
  },
  // Deck settings
  {
    name: 'update_deck_settings',
    description: 'Update deck-level settings like title, description, aspect ratio, grid columns, default backdrop, and default start point',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Deck title',
        },
        description: {
          type: 'string',
          description: 'Deck description',
        },
        aspectRatio: {
          type: 'string',
          enum: ['16:9', '4:3', '16:10'],
          description: 'Slide aspect ratio',
        },
        gridColumns: {
          type: 'number',
          description: 'Number of grid columns for component layout (1-12)',
        },
        defaultBackdropSlideId: {
          type: 'string',
          description: 'ID of slide to use as default backdrop for all slides',
        },
        defaultStartPointId: {
          type: 'string',
          description: 'ID of default start point for presentations and thumbnail generation',
        },
      },
      required: [],
    },
  },
  // Theme tools
  {
    name: 'update_theme',
    description: 'Update theme design tokens (colors, typography, spacing)',
    input_schema: {
      type: 'object' as const,
      properties: {
        tokens: {
          type: 'object',
          description: 'Theme tokens to update',
          properties: {
            'font-display': { type: 'string', description: 'Display/heading font family' },
            'font-body': { type: 'string', description: 'Body text font family' },
            'font-size-base': { type: 'string', description: 'Base font size (e.g., "16px")' },
            'font-size-scale': { type: 'number', description: 'Type scale ratio (e.g., 1.25)' },
            'color-background': { type: 'string', description: 'Primary background color (hex)' },
            'color-surface': { type: 'string', description: 'Surface/card background color (hex)' },
            'color-text-primary': { type: 'string', description: 'Primary text color (hex)' },
            'color-text-secondary': { type: 'string', description: 'Secondary/muted text color (hex)' },
            'color-accent': { type: 'string', description: 'Accent/brand color (hex)' },
            'color-accent-contrast': { type: 'string', description: 'Text color on accent background (hex)' },
            'space-unit': { type: 'string', description: 'Base spacing unit (e.g., "8px")' },
            'grid-gap': { type: 'string', description: 'Gap between grid items' },
            'content-padding-top': { type: 'string', description: 'Padding from top/bottom edge to content' },
            'content-padding-sides': { type: 'string', description: 'Padding from left/right edges to content' },
            'radius-sm': { type: 'string', description: 'Small border radius' },
            'radius-md': { type: 'string', description: 'Medium border radius' },
            'radius-lg': { type: 'string', description: 'Large border radius' },
          },
        },
      },
      required: ['tokens'],
    },
  },
  // Capture tool (async — handled in chat route, not executeToolCall)
  {
    name: 'capture_slide',
    description: 'Capture a screenshot of a slide as it currently appears. Returns a base64 image. Use this to visually inspect slide layout, check alignment, verify colors, or review the overall look. Requires at least one client connected.',
    input_schema: {
      type: 'object' as const,
      properties: {
        slideId: {
          type: 'string',
          description: 'The ID of the slide to capture',
        },
      },
      required: ['slideId'],
    },
  },
  // State inspection tools
  {
    name: 'list_assets',
    description: 'List all uploaded assets (images, files) available in the deck. Returns asset IDs needed for deck-image components.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_deck_state',
    description: 'Get the full current state of the deck. Always returns deckSettings (title, aspectRatio, gridColumns, defaultBackdropSlideId, defaultStartPointId). Use include parameter to add: slides (with full style, notes, gridColumns, components), edges, startPoints, theme (with all tokens), assets. Call this to understand current state before making changes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        include: {
          type: 'array',
          items: { type: 'string', enum: ['slides', 'edges', 'startPoints', 'theme', 'assets', 'all'] },
          description: 'What to include in the response. Defaults to ["slides", "edges", "assets"]. Use "all" for complete state.',
        },
      },
      required: [],
    },
  },
  // Position/movement tools
  {
    name: 'move_slide',
    description: 'Move a slide to a new position on the canvas',
    input_schema: {
      type: 'object' as const,
      properties: {
        slideId: {
          type: 'string',
          description: 'The ID of the slide to move',
        },
        x: {
          type: 'number',
          description: 'New X position on canvas',
        },
        y: {
          type: 'number',
          description: 'New Y position on canvas',
        },
      },
      required: ['slideId', 'x', 'y'],
    },
  },
  {
    name: 'move_component',
    description: 'Move a component to a new position within a slide (reorder)',
    input_schema: {
      type: 'object' as const,
      properties: {
        slideId: {
          type: 'string',
          description: 'The ID of the slide containing the component',
        },
        componentId: {
          type: 'string',
          description: 'The ID of the component to move',
        },
        newIndex: {
          type: 'number',
          description: 'New index position (0-based)',
        },
      },
      required: ['slideId', 'componentId', 'newIndex'],
    },
  },
];

/**
 * Result of tool execution
 */
interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Execute a tool call and apply changes to the YDoc.
 * 
 * Uses domain mutation functions from @deckhand/schema, then
 * diffs the result and applies patches to the YDoc.
 */
export function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  ydoc: Y.Doc,
  deck: Deck
): ToolResult {
  try {
    let newDeck: Deck;
    let resultData: unknown;

    switch (toolName) {
      case 'add_slide': {
        const options = input as AddSlideOptions;
        const result = addSlide(deck, options);
        newDeck = result.deck;
        resultData = { slideId: result.slideId };
        break;
      }

      case 'duplicate_slide': {
        const { slideId, title } = input as { slideId: string; title?: string };
        const result = duplicateSlide(deck, slideId, title ? { title } : undefined);
        newDeck = result.deck;
        resultData = { newSlideId: result.newSlideId, sourceSlideId: slideId };
        break;
      }

      case 'update_slide': {
        const { slideId, updates } = input as { slideId: string; updates: UpdateSlideOptions };
        newDeck = updateSlide(deck, slideId, updates);
        resultData = { slideId, updates };
        break;
      }

      case 'delete_slide': {
        const { slideId } = input as { slideId: string };
        newDeck = deleteSlide(deck, slideId);
        resultData = { slideId };
        break;
      }

      case 'add_component': {
        const { slideId, component, position, parentId } = input as {
          slideId: string;
          component: { type: string; props: Record<string, unknown> };
          position?: number;
          parentId?: string;
        };
        // Validate component type
        if (!component?.type || !componentTypes.includes(component.type as any)) {
          return {
            success: false,
            error: `Invalid component type "${component?.type}". Must be one of: ${componentTypes.join(', ')}`,
          };
        }
        // Validate props against schema
        const parseResult = ComponentSchema.safeParse({
          id: 'temp',
          type: component.type,
          props: component.props || {},
        });
        if (!parseResult.success) {
          const issues = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
          return {
            success: false,
            error: `Invalid props for ${component.type}: ${issues}`,
          };
        }
        const options: AddComponentOptions = {
          type: component.type,
          props: component.props,
          position,
          parentId,
        };
        const result = addComponent(deck, slideId, options);
        newDeck = result.deck;
        resultData = { slideId, componentId: result.componentId, parentId };
        break;
      }

      case 'update_component': {
        const { slideId, componentId, props } = input as {
          slideId: string;
          componentId: string;
          props: Record<string, unknown>;
        };
        // Guard: props must be a plain object (LLM may send a string)
        if (!props || typeof props !== 'object' || Array.isArray(props)) {
          return {
            success: false,
            error: `props must be an object, got ${typeof props}`,
          };
        }
        const existingComponent = deck.slides[slideId]?.components.find(c => c.id === componentId);
        if (!existingComponent) {
          return {
            success: false,
            error: `Component "${componentId}" not found in slide "${slideId}"`,
          };
        }
        // Validate merged props against schema
        const mergedProps = { ...existingComponent.props, ...props };
        const parseResult = ComponentSchema.safeParse({
          id: existingComponent.id,
          type: existingComponent.type,
          props: mergedProps,
        });
        if (!parseResult.success) {
          const issues = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
          return {
            success: false,
            error: `Invalid props for ${existingComponent.type}: ${issues}`,
          };
        }
        console.log('[update_component] Input props:', JSON.stringify(props));
        const oldComponent = existingComponent;
        console.log('[update_component] Old component props:', JSON.stringify(oldComponent?.props));
        newDeck = updateComponent(deck, slideId, componentId, props);
        const newComponent = newDeck.slides[slideId]?.components.find(c => c.id === componentId);
        console.log('[update_component] New component props:', JSON.stringify(newComponent?.props));
        resultData = { slideId, componentId, props };
        break;
      }

      case 'delete_component': {
        const { slideId, componentId } = input as {
          slideId: string;
          componentId: string;
        };
        newDeck = deleteComponent(deck, slideId, componentId);
        resultData = { slideId, componentId };
        break;
      }

      // Edge tools
      case 'add_edge': {
        const { from, to, trigger, label, transition, transitionDuration } = input as {
          from: string;
          to: string;
          trigger?: string;
          label?: string;
          transition?: string;
          transitionDuration?: number;
        };
        const options: AddEdgeOptions = {
          from,
          to,
          trigger: trigger as AddEdgeOptions['trigger'],
          label,
          transition: transition as AddEdgeOptions['transition'],
          transitionDuration,
        };
        const result = addEdge(deck, options);
        newDeck = result.deck;
        resultData = { edgeId: result.edgeId };
        break;
      }

      case 'update_edge': {
        const { edgeId, updates } = input as { edgeId: string; updates: UpdateEdgeOptions };
        newDeck = updateEdge(deck, edgeId, updates);
        resultData = { edgeId, updates };
        break;
      }

      case 'delete_edge': {
        const { edgeId } = input as { edgeId: string };
        newDeck = deleteEdge(deck, edgeId);
        resultData = { edgeId };
        break;
      }

      // Start point tools
      case 'add_start_point': {
        const { name, connectToSlide } = input as {
          name: string;
          connectToSlide?: string;
        };
        const options: AddStartPointOptions = { name, connectToSlide };
        const result = addStartPoint(deck, options);
        newDeck = result.deck;
        resultData = { startPointId: result.startPointId, edgeId: result.edgeId };
        break;
      }

      case 'update_start_point': {
        const { startPointId, updates } = input as { startPointId: string; updates: UpdateStartPointOptions };
        newDeck = updateStartPoint(deck, startPointId, updates);
        resultData = { startPointId, updates };
        break;
      }

      case 'delete_start_point': {
        const { startPointId } = input as { startPointId: string };
        newDeck = deleteStartPoint(deck, startPointId);
        resultData = { startPointId };
        break;
      }

      // Flow settings
      case 'update_flow_settings': {
        const updates = input as UpdateFlowSettingsOptions;
        newDeck = updateFlowSettings(deck, updates);
        resultData = { updates };
        break;
      }

      // Deck settings
      case 'update_deck_settings': {
        const { title, description, aspectRatio, gridColumns, defaultBackdropSlideId, defaultStartPointId } = input as {
          title?: string;
          description?: string;
          aspectRatio?: string;
          gridColumns?: number;
          defaultBackdropSlideId?: string;
          defaultStartPointId?: string;
        };
        const updates: UpdateDeckSettingsOptions = {
          title,
          description,
          aspectRatio: aspectRatio as UpdateDeckSettingsOptions['aspectRatio'],
          gridColumns,
          defaultBackdropSlideId,
          defaultStartPointId,
        };
        newDeck = updateDeckSettings(deck, updates);
        resultData = { updates };
        break;
      }

      // Theme
      case 'update_theme': {
        const { tokens } = input as { tokens: ThemeTokenUpdates };
        newDeck = updateTheme(deck, tokens);
        resultData = { tokens };
        break;
      }

      // Position/movement
      case 'move_slide': {
        const { slideId, x, y } = input as { slideId: string; x: number; y: number };
        newDeck = moveSlide(deck, slideId, { x, y });
        resultData = { slideId, position: { x, y } };
        break;
      }

      case 'move_component': {
        const { slideId, componentId, newIndex } = input as {
          slideId: string;
          componentId: string;
          newIndex: number;
        };
        newDeck = moveComponent(deck, slideId, componentId, newIndex);
        resultData = { slideId, componentId, newIndex };
        break;
      }

      // State inspection (read-only, no mutations)
      case 'get_flow_graph': {
        const slides = Object.values(deck.slides).map(s => ({
          id: s.id,
          title: s.title,
        }));
        const edges = Object.values(deck.flow.edges).map(e => ({
          id: e.id,
          from: e.from,
          to: e.to,
          trigger: e.trigger,
          label: e.label,
          transition: e.transition,
          transitionDuration: e.transitionDuration,
        }));
        const startPoints = deck.flow.startPoints
          ? Object.values(deck.flow.startPoints).map(sp => ({
              id: sp.id,
              name: sp.name,
            }))
          : [];
        return {
          success: true,
          data: {
            slides,
            edges,
            startPoints,
            defaultStartPointId: deck.defaultStartPointId || null,
            defaultTransition: deck.flow.defaultTransition || 'instant',
            defaultTransitionDuration: deck.flow.defaultTransitionDuration ?? 0.3,
          },
        };
      }

      case 'list_assets': {
        const assets = Object.values(deck.assets || {}).map(asset => ({
          id: asset.id,
          filename: asset.filename,
          mimeType: asset.mimeType,
          size: asset.size,
        }));
        return { success: true, data: { assets, count: assets.length } };
      }

      case 'get_deck_state': {
        const { include = ['slides', 'edges', 'assets'] } = input as { include?: string[] };
        const includeAll = include.includes('all');
        
        const state: Record<string, unknown> = {};
        
        // Deck-level settings (always included)
        state.deckSettings = {
          id: deck.meta.id,
          title: deck.meta.title,
          description: deck.meta.description,
          aspectRatio: deck.aspectRatio,
          gridColumns: deck.gridColumns,
          defaultBackdropSlideId: deck.defaultBackdropSlideId,
          defaultStartPointId: deck.defaultStartPointId,
        };
        
        if (includeAll || include.includes('slides')) {
          state.slides = Object.values(deck.slides).map(slide => ({
            id: slide.id,
            title: slide.title,
            notes: slide.notes,
            position: slide.position,
            gridColumns: slide.gridColumns,
            style: slide.style ? {
              background: slide.style.background,
              textPrimary: slide.style.textPrimary,
              textSecondary: slide.style.textSecondary,
              accent: slide.style.accent,
              backgroundAssetId: slide.style.backgroundAssetId,
              backgroundSize: slide.style.backgroundSize,
              backgroundDarken: slide.style.backgroundDarken,
              backgroundBlur: slide.style.backgroundBlur,
              backgroundTransparent: slide.style.backgroundTransparent,
              backdropSlideId: slide.style.backdropSlideId,
            } : undefined,
            components: slide.components.map(c => ({
              id: c.id,
              type: c.type,
              parentId: c.parentId, // Set for components inside containers
              props: c.props,
            })),
          }));
        }
        
        if (includeAll || include.includes('edges')) {
          state.edges = Object.values(deck.flow.edges).map(edge => ({
            id: edge.id,
            from: edge.from,
            to: edge.to,
            trigger: edge.trigger,
            label: edge.label,
            transition: edge.transition,
            transitionDuration: edge.transitionDuration,
          }));
          state.flowSettings = {
            defaultTransition: deck.flow.defaultTransition || 'instant',
            defaultTransitionDuration: deck.flow.defaultTransitionDuration,
          };
        }
        
        if (includeAll || include.includes('startPoints')) {
          state.startPoints = Object.values(deck.flow.startPoints || {}).map(sp => ({
            id: sp.id,
            name: sp.name,
            position: sp.position,
          }));
        }
        
        if (includeAll || include.includes('theme')) {
          state.theme = {
            id: deck.theme.id,
            name: deck.theme.name,
            tokens: deck.theme.tokens,
          };
        }
        
        if (includeAll || include.includes('assets')) {
          state.assets = Object.values(deck.assets || {}).map(asset => ({
            id: asset.id,
            filename: asset.filename,
            mimeType: asset.mimeType,
            size: asset.size,
          }));
        }
        
        // Return early - no mutations to apply
        return { success: true, data: state };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }

    // Diff and apply patches to YDoc
    const patches = diffDeck(deck, newDeck);
    console.log('[executeToolCall] Patches:', JSON.stringify(patches, null, 2));
    if (patches.length > 0) {
      ydoc.transact(() => {
        applyPatchesToYDoc(patches, ydoc);
      }, 'llm');
    }

    return { success: true, data: resultData };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
