/**
 * System prompts for the LLM assistant.
 */

import type { Deck } from '@deckhand/schema';
import type Anthropic from '@anthropic-ai/sdk';
import { SLIDE_WIDTH, SLIDE_HEIGHTS, generateComponentDocs } from '@deckhand/schema';
import { tools } from './tools.js';

interface ChatContext {
  selectedSlideId?: string;
  selectedComponentId?: string;
}

/**
 * Generate documentation for all available tools from their definitions.
 */
function generateToolDocumentation(): string {
  return tools.map(tool => {
    const schema = tool.input_schema;
    const properties = schema.properties as Record<string, { type?: string; description?: string; enum?: string[] }>;
    const required = (schema.required as string[]) || [];
    
    const params = Object.entries(properties).map(([name, prop]) => {
      const isRequired = required.includes(name);
      const typeInfo = prop.enum ? prop.enum.join(' | ') : prop.type || 'any';
      const reqMarker = isRequired ? ' (required)' : '';
      return `    - ${name}: ${typeInfo}${reqMarker}${prop.description ? ` - ${prop.description}` : ''}`;
    }).join('\n');
    
    return `- **${tool.name}**: ${tool.description}
${params || '    (no parameters)'}`;
  }).join('\n\n');
}

/**
 * Build a summary of the current deck state.
 */
function buildDeckStateSummary(deck: Deck): string {
  const slidesSummary = Object.values(deck.slides).map(slide => {
    const componentsSummary = slide.components.map(c => 
      `    - ${c.id} (${c.type}): ${JSON.stringify(c.props).slice(0, 100)}...`
    ).join('\n');
    
    return `  ${slide.id}: "${slide.title || 'Untitled'}"
${componentsSummary || '    (no components)'}`;
  }).join('\n');

  const edgesSummary = Object.values(deck.flow.edges).map(edge => {
    const trigger = edge.trigger === 'default' ? 'next' : edge.trigger;
    const transition = edge.transition || deck.flow.defaultTransition || 'instant';
    return `  ${edge.id}: ${edge.from} → ${edge.to} (${trigger}, ${transition})${edge.label ? ` "${edge.label}"` : ''}`;
  }).join('\n');

  const startPointsSummary = Object.values(deck.flow.startPoints || {}).map(sp => 
    `  ${sp.id}: "${sp.name}"`
  ).join('\n');

  const slideWidth = SLIDE_WIDTH;
  const slideHeight = SLIDE_HEIGHTS[deck.aspectRatio] || SLIDE_HEIGHTS['16:9'];

  const themeSummary = `Colors: bg=${deck.theme.tokens['color-background']}, text=${deck.theme.tokens['color-text-primary']}, accent=${deck.theme.tokens['color-accent']}
  Fonts: display="${deck.theme.tokens['font-display']?.split(',')[0]}", body="${deck.theme.tokens['font-body']?.split(',')[0]}"
  Spacing: padding-top=${deck.theme.tokens['content-padding-top'] || '48px'}, padding-sides=${deck.theme.tokens['content-padding-sides'] || '64px'}`;

  return `**Title:** ${deck.meta.title || 'Untitled Deck'}
**Aspect Ratio:** ${deck.aspectRatio} (${slideWidth}×${slideHeight}px)
**Grid Columns:** ${deck.gridColumns}
**Default Backdrop:** ${deck.defaultBackdropSlideId || 'none'}
**Default Transition:** ${deck.flow.defaultTransition || 'instant'}

**Theme:**
${themeSummary}

**Slides:**
${slidesSummary || '(no slides)'}

**Edges (Navigation Flow):**
${edgesSummary || '(no edges)'}

**Start Points:**
${startPointsSummary || '(no start points)'}

**Assets:**
${Object.entries(deck.assets || {}).map(([id, asset]) => 
  `  ${id}: ${asset.filename} (${asset.mimeType})`
).join('\n') || '(no assets)'}`;
}

/**
 * Build the base system prompt (static instructions).
 * This is the same for all messages in a session.
 */
function buildBasePrompt(): string {
  return `You are Deckhand, an AI assistant for creating and editing presentations.

## Component Types

${generateComponentDocs()}

## Slide Style Properties

Each slide can have style overrides (via update_slide tool):
- **background**: Background color override (hex)
- **textPrimary/textSecondary/accent**: Color overrides for this slide
- **backgroundAssetId**: Asset ID for background image
- **backgroundSize**: "fill" (cover), "fit-width", or "fit-height"
- **backgroundDarken**: 0-100, darkens background image
- **backgroundBlur**: 0-20px blur on background
- **backgroundTransparent**: true to make slide background transparent (useful for backdrop slides)
- **backdropSlideId**: ID of another slide to render behind this one (for reusable footers/logos). Use "__none__" to explicitly disable default backdrop.

## Slide Dimensions & Positioning

Slides are ${SLIDE_WIDTH}px wide. Height depends on aspect ratio (shown in deck state).
When adding slides, auto-positioning handles placement. If you use move_slide:
- Horizontal spacing: ${SLIDE_WIDTH + 80}px between slide x positions (slide width + 80px gap)
- Vertical spacing: use slide height + 80px for branching rows
- Check existing slide positions to avoid overlaps

## Available Tools

${generateToolDocumentation()}

## Instructions

**CRITICAL RULES - VIOLATION WILL CAUSE FAILURES:**

1. **YOU MUST CALL TOOLS TO MAKE CHANGES.** You have NO ability to modify the deck except through tool calls. If you say "Done!" without having called tools, NOTHING HAPPENED. The user sees tool call logs and will know you lied.

2. **NEVER claim to have made changes without actually calling tools.** If you want to update 6 slides, you must call update_slide 6 times. There are no shortcuts.

3. **DESCRIBE BRIEFLY, THEN CALL TOOLS.** First say what you plan to do in one sentence, then immediately call the tools. Example: "I'll update the background color on all 6 slides." [then call update_slide 6 times]

**Additional guidelines:**
- When the user says "this slide", "this", "the current slide", or similar, they mean the **selected slide** shown in the context.
- When the user says "this component" or refers to content without specifying, they mean the **selected component** if one is selected.
- If no slide is selected and the user says "this", ask which slide they mean or use get_deck_state to list slides.
- For colors, use hex format (e.g., "#ff0000" for red).
- For text content, be creative but professional unless given specific text.
- After making changes, briefly confirm what you did.
- If the request is ambiguous, ask for clarification rather than guessing.
- For navigation flow, use edges to connect slides. Start points provide named entry points for different presentation paths. Use get_flow_graph to inspect the full navigation structure (edges, start points, defaults).
- Use duplicate_slide to copy an existing slide as a starting point — it deep-copies all components and layout.
- **Component links**: Use add_edge with a component ID as 'from' to make any component clickable in presentation mode. Clicking navigates to the target slide. Example: add_edge({ from: "comp-abc123", to: "slide-metrics" })
- Use get_deck_state, get_flow_graph, or list_assets to see current state if you need to reference existing content.
- If you see [CLIENT RENDER ERRORS], your changes produced invalid output (e.g., bad Mermaid syntax). Fix the affected components immediately.

Be concise in your responses. The user can see the changes in real-time.`;
}

/**
 * Build detailed info about the selected slide.
 */
function buildSelectedSlideInfo(deck: Deck, context?: ChatContext): string {
  if (!context?.selectedSlideId) {
    return `**Selected Slide:** None (user may need to specify which slide)`;
  }

  const slide = deck.slides[context.selectedSlideId];
  if (!slide) {
    return `**Selected Slide:** ${context.selectedSlideId} (not found)`;
  }

  const selectedComponent = context.selectedComponentId
    ? slide.components.find(c => c.id === context.selectedComponentId)
    : null;

  const componentsList = slide.components.map((c, i) => {
    const isSelected = c.id === context.selectedComponentId;
    const marker = isSelected ? ' ← SELECTED' : '';
    return `  ${i + 1}. ${c.id} (${c.type})${marker}`;
  }).join('\n');

  // Build style info if slide has style overrides
  const style = slide.style;
  const styleInfo = style ? Object.entries(style)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ') : null;

  return `**Selected Slide:** ${slide.id} ("${slide.title || 'Untitled'}")
  - Position: (${slide.position.x}, ${slide.position.y})
  - Grid columns: ${slide.gridColumns || deck.gridColumns}
${styleInfo ? `  - Style: ${styleInfo}\n` : ''}  - Components (${slide.components.length}):
${componentsList || '    (none)'}
${selectedComponent 
  ? `\n**Selected Component:** ${selectedComponent.id} (${selectedComponent.type})
  - Props: ${JSON.stringify(selectedComponent.props, null, 2).split('\n').join('\n    ')}`
  : ''}`;
}

/**
 * Build system prompt as content blocks for prompt caching.
 *
 * Block 1: Static instructions + tool docs (large, cacheable across all turns)
 * Block 2: Dynamic deck state + selection (changes each turn, not cached)
 *
 * The cache_control breakpoint on block 1 tells the API to cache everything
 * up to that point. Subsequent calls reuse the cached prefix even when
 * the dynamic block changes.
 */
export function buildSystemPrompt(
  deck: Deck,
  context?: ChatContext,
  hasHistory?: boolean
): Anthropic.TextBlockParam[] {
  const dynamicContext = hasHistory
    ? `## Context

Deck: "${deck.meta.title || 'Untitled'}" (${Object.keys(deck.slides).length} slides)

## Current Selection (what "this" refers to)

${buildSelectedSlideInfo(deck, context)}

Note: Use get_deck_state tool to see full deck state if needed.`
    : `## Current Deck State

${buildDeckStateSummary(deck)}

## Current Selection (what "this" refers to)

${buildSelectedSlideInfo(deck, context)}`;

  return [
    {
      type: 'text' as const,
      text: buildBasePrompt(),
      cache_control: { type: 'ephemeral' as const },
    },
    {
      type: 'text' as const,
      text: dynamicContext,
    },
  ];
}

// Keep for backwards compat — not used in new code
export const buildContinuationPrompt = buildSystemPrompt;
