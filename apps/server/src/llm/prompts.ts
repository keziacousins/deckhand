/**
 * System prompts for the LLM assistant.
 */

import type { Deck } from '@deckhand/schema';
import { SLIDE_WIDTH, SLIDE_HEIGHTS } from '@deckhand/schema';
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
**Entry Slide:** ${deck.flow.entrySlide}
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

Available components you can add:
- **deck-title**: Heading text. Props: text (string), level ("1"|"2"|"3"), align ("left"|"center"|"right"), gridWidth (number)
- **deck-text**: Rich text paragraph. Props: content (array of {text, bold?, italic?, underline?, code?, href?}), align, gridWidth
- **deck-list**: Bullet or numbered list. Props: items (string[]), ordered (boolean), gridWidth
- **deck-image**: Image from assets. Props: assetId (string), alt, caption, fit ("contain"|"cover"|"fill"), darken (0-100), blur (0-20), maxHeight, gridWidth
- **deck-headline-subhead**: Headline with subheading. Props: headline, subheading, category, isHero (boolean), variant ("dark"|"light"), align, gridWidth

## Slide Positioning

When adding new slides, position them on the canvas so they don't overlap:
- Slides are typically arranged in a horizontal row (increasing x, same y)
- Standard horizontal spacing: 350px between slide x positions
- Standard vertical spacing: 550px between rows (for branching flows)
- Check existing slide positions before adding new ones to avoid overlaps

## Available Tools

${generateToolDocumentation()}

## Instructions

**CRITICAL: You MUST use tools to make any changes to the deck.** You cannot modify slides, components, or any deck content without calling the appropriate tool. Never claim to have made changes without actually calling a tool - the user can see whether tools were called.

1. When the user says "this slide", "this", "the current slide", or similar, they mean the **selected slide** shown in the context.
2. When the user says "this component" or refers to content without specifying, they mean the **selected component** if one is selected.
3. If no slide is selected and the user says "this", ask which slide they mean or use get_deck_state to list slides.
4. For colors, use hex format (e.g., "#ff0000" for red).
5. For text content, be creative but professional unless given specific text.
6. After making changes, briefly confirm what you did.
7. If the request is ambiguous, ask for clarification rather than guessing.
8. For navigation flow, use edges to connect slides. Start points provide named entry points for different presentation paths.
9. Use get_deck_state or list_assets to see current state if you need to reference existing content.

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

  return `**Selected Slide:** ${slide.id} ("${slide.title || 'Untitled'}")
  - Position: (${slide.position.x}, ${slide.position.y})
  - Grid columns: ${slide.gridColumns || deck.gridColumns}
  - Components (${slide.components.length}):
${componentsList || '    (none)'}
${selectedComponent 
  ? `\n**Selected Component:** ${selectedComponent.id} (${selectedComponent.type})
  - Props: ${JSON.stringify(selectedComponent.props, null, 2).split('\n').join('\n    ')}`
  : ''}`;
}

/**
 * Build the system prompt for the first message in a session.
 * Includes full deck state so the agent has context.
 */
export function buildSystemPrompt(deck: Deck, context?: ChatContext): string {
  const selectionInfo = `## Current Selection (what "this" refers to)

${buildSelectedSlideInfo(deck, context)}`;

  return `${buildBasePrompt()}

## Current Deck State

${buildDeckStateSummary(deck)}

${selectionInfo}`;
}

/**
 * Build a lighter system prompt for continuing a session.
 * Only includes selection context - agent can use get_deck_state for full state.
 */
export function buildContinuationPrompt(deck: Deck, context?: ChatContext): string {
  return `${buildBasePrompt()}

## Context

Deck: "${deck.meta.title || 'Untitled'}" (${Object.keys(deck.slides).length} slides)

## Current Selection (what "this" refers to)

${buildSelectedSlideInfo(deck, context)}

Note: Use get_deck_state tool to see full deck state if needed.`;
}
