# Deckhand Architecture

## What This Is

LLM-first presentation authoring. Users describe slides in natural language, an LLM edits a structured JSON document, and web components render the result. Real-time collaboration via YJS.

## Core Principles

1. **LLM-first** — Natural language is the primary authoring interface. The inspector is secondary.
2. **Structured content** — Slides are validated JSON schemas, not pixels or HTML.
3. **Minimal primitives** — Three component types (text, image, container) compose into anything. Complex layouts are compositions, not new component types.
4. **Same renderer everywhere** — Web components with Shadow DOM render identically in editor preview, presentation mode, and future export.
5. **JSON is truth** — No YAML, no intermediate formats. JSON document validated by Zod schemas.

## System Shape

```
┌─────────────────────────────────────────────────────────┐
│                     Editor (React)                       │
│  Canvas (React Flow)  │  Inspector  │  LLM Chat Panel   │
└───────────────────────┬─────────────────────────────────┘
                        │
              ┌─────────▼─────────┐
              │   Zod Schemas     │  ← Single source of type truth
              │  (pure functions) │
              └─────────┬─────────┘
                        │
           ┌────────────┼────────────┐
           ▼            ▼            ▼
     ┌──────────┐ ┌──────────┐ ┌──────────────┐
     │ ID-based │ │  YDoc    │ │ Web Component │
     │   Diff   │ │  Sync    │ │   Renderer    │
     └──────────┘ └──────────┘ └──────────────┘
```

## Data Flow

All mutations follow the same path regardless of source (LLM tool call, inspector edit, direct content edit):

1. Pure function produces new deck state from old
2. ID-based diff computes minimal patches
3. Patches applied to YDoc (with origin tracking for undo)
4. YDoc syncs to all connected clients via WebSocket
5. Clients convert YDoc back to deck state, re-render

This means the LLM and the user are peers — both produce the same kind of patches.

## Key Architectural Decisions

### Objects keyed by ID, not arrays
Slides, edges, start points, and assets are all `Record<string, T>` — keyed by ID. This enables efficient CRDT sync (no array index conflicts) and granular ID-based patching.

Components within a slide are the exception — they're an ordered array because display order matters and reordering is a common operation.

### Shadow DOM isolation
Web components use Shadow DOM, creating a hard boundary between editor UI styles and slide content styles. Theme tokens cross the boundary via CSS custom properties (`--deck-*`). Editor styles never reference deck tokens; component styles never reference editor classes.

### Self-describing components
Each web component carries static `.meta` declaring its properties, types, groups, and defaults. The inspector auto-generates editors from this metadata — no hardcoded field lists. Adding a prop to a component automatically surfaces it in the inspector.

### Reusable schema fragments
Shared property groups (like `GridPropsSchema`, `VisualPropsSchema`) are defined once and merged into multiple component schemas. Matching `CommonProperties` factories produce inspector meta descriptors. This keeps image and container border/shadow/radius controls identical by construction.

### Canvas is read-only visualization
React Flow canvas is for spatial arrangement and navigation flow editing only. Content editing happens through LLM tools or the inspector. The canvas renders scaled-down previews of actual web components.

### Undo via YDoc UndoManager
The YDoc UndoManager tracks changes with `'local'` origin. Inspector edits and direct edits use this origin; LLM changes and server sync do not, so Ctrl+Z only undoes the user's own actions.

## Monorepo Structure

- **`packages/schema`** — Zod schemas, TypeScript types, pure mutation functions. Zero runtime dependencies beyond Zod. This is the contract everything else depends on.
- **`packages/sync`** — ID-based JSON diffing, patch generation, YDoc conversion. The bridge between pure JSON state and CRDT collaboration.
- **`packages/components`** — Vanilla web components (Shadow DOM). Framework-agnostic. Depends only on schema types for metadata.
- **`apps/editor`** — React + Vite frontend. Canvas (React Flow), inspector, chat panel, YDoc client.
- **`apps/server`** — Express backend. WebSocket for YDoc sync, REST for CRUD, SQLite for persistence, LLM tool execution.

## Persistence

SQLite stores both the deck JSON (source of truth) and the YDoc binary state (ephemeral collaboration state). On connect, a content hash check determines whether to fast-load the YDoc binary or rebuild it from JSON for consistency recovery.

## LLM Integration

The LLM receives tool definitions generated from the same schema that validates documents. Tool execution follows the standard mutation path: pure function → diff → patch → YDoc → sync. The LLM sees the current deck state in its system prompt and uses tools like `add_component`, `update_component`, `update_slide`, etc.

## Future: Blocks and Themes

See `PLAN-themes-and-blocks.md` for the roadmap:
- **Blocks** — Reusable compositions of primitives with named slots (per-deck)
- **Themes** — Shareable bundles of tokens, assets, and blocks across decks
