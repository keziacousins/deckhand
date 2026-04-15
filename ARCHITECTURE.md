# Deckhand Architecture

## What This Is

LLM-first presentation authoring. Users describe slides in natural language, an LLM edits a structured JSON document, and web components render the result. Real-time multi-user collaboration via YJS.

## Core Principles

1. **LLM-first** — Natural language is the primary authoring interface. The inspector is secondary.
2. **Structured content** — Slides are validated JSON schemas, not pixels or HTML.
3. **Minimal primitives** — A small set of component types (text, image, container, diagram) compose into anything. Complex layouts are compositions, not new component types.
4. **Same renderer everywhere** — Web components with Shadow DOM render identically in editor preview, presentation mode, and public sharing.
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

## Monorepo Structure

- **`packages/schema`** — Zod schemas, TypeScript types, pure mutation functions. Zero runtime dependencies beyond Zod. This is the contract everything else depends on.
- **`packages/sync`** — ID-based JSON diffing, patch generation, YDoc conversion. The bridge between pure JSON state and CRDT collaboration.
- **`packages/components`** — Vanilla web components (Shadow DOM). Framework-agnostic. Depends only on schema types for metadata.
- **`apps/editor`** — React + Vite frontend. Canvas (React Flow), inspector, chat panel, YDoc client, presentation viewer.
- **`apps/server`** — Express backend. WebSocket for YDoc sync, REST for CRUD, PostgreSQL for persistence, LLM tool execution.

## Component Model

Five web components, all using Shadow DOM:

- **`deck-slide`** — The slide container. Applies theme tokens as CSS custom properties, handles grid layout (`gridColumns`), background images (via asset system), and backdrop slides. Not authored directly — one per slide.
- **`deck-text`** — All text content. Plain string with opt-in `markdown: true` for GFM (rendered via `marked`, sanitized with DOMPurify). Props: size, weight, align, transform, color.
- **`deck-image`** — Images from the asset system. Props: assetId, fit, darken, blur, maxWidth/maxHeight, align, color (SVG fill).
- **`deck-container`** — Layout grouping. Grid mode (gridWidth sets span + internal columns) or floating mode (anchorX/anchorY for absolute positioning). Props: background, padding, gap, alignItems, justifyContent.
- **`deck-diagram`** — Mermaid diagrams with theme-aware rendering. Props: code, theme.

Shared `VisualPropsSchema` on image + container provides borderRadius, borderWidth, borderColor, shadow, shadowColor.

Each component carries static `.meta` declaring its properties, types, groups, and defaults. The inspector auto-generates editors from this metadata — no hardcoded field lists.

## Key Architectural Decisions

### Objects keyed by ID, not arrays
Slides, edges, start points, and assets are all `Record<string, T>` — keyed by ID. This enables efficient CRDT sync (no array index conflicts) and granular ID-based patching.

Components within a slide are the exception — they're an ordered array because display order matters and reordering is a common operation.

### Shadow DOM isolation
Web components use Shadow DOM, creating a hard boundary between editor UI styles and slide content styles. Theme tokens cross the boundary via CSS custom properties (`--deck-*`). Editor styles never reference deck tokens; component styles never reference editor classes.

### Self-describing components
Each web component carries static `.meta` declaring its properties, types, groups, and defaults. The inspector auto-generates editors from this metadata. Adding a prop to a component automatically surfaces it in the inspector.

### Reusable schema fragments
Shared property groups (like `GridPropsSchema`, `VisualPropsSchema`) are defined once and merged into multiple component schemas. Matching `CommonProperties` factories produce inspector meta descriptors. This keeps image and container border/shadow/radius controls identical by construction.

### Canvas is read-only visualization
React Flow canvas is for spatial arrangement and navigation flow editing only. Content editing happens through LLM tools or the inspector. The canvas renders scaled-down previews of actual web components.

### Undo via YDoc UndoManager
The YDoc UndoManager tracks changes with `'local'` origin. Inspector edits and direct edits use this origin; LLM changes use a separate `'llm'` origin with per-chat-session undo managers, so each chat conversation has its own undo stack.

## Auth & Identity

Authentication uses Ory Kratos (identity management) and Ory Hydra (OAuth2/OIDC). The flow:

1. Editor redirects to Kratos for login/registration
2. Kratos authenticates, redirects through Hydra for OAuth2 consent
3. Hydra issues JWT access tokens
4. Server validates JWTs via JWKS endpoint for both REST and WebSocket connections
5. WebSocket connections support token refresh — clients send new tokens over the existing connection

Deck access control uses an owner + shares model: each deck has an owner, and `deck_shares` grants `editor` or `viewer` roles to other users.

## Persistence

PostgreSQL stores deck content (JSON), YDoc binary state, user profiles, chat sessions/messages, assets metadata, and sharing permissions.

On WebSocket connect, a content hash check determines whether to fast-load the YDoc binary or rebuild it from the JSON source of truth — this handles consistency recovery if the YDoc state diverges.

## LLM Integration

The LLM receives tool definitions generated from the same schema that validates documents. Tool execution follows the standard mutation path: pure function → diff → patch → YDoc → sync. The LLM sees the current deck state in its system prompt and uses tools like `add_component`, `update_component`, `update_slide`, etc.

Chat is multi-user: any editor on a deck can chat, messages are attributed to users, and all connected clients see LLM edits in real time via YDoc sync. Each chat session has its own LLM undo stack.

## Real-Time Collaboration

YJS provides the CRDT layer. The server maintains in-memory sessions per deck, each holding a Y.Doc and a set of connected WebSocket clients.

Presence features: cursor positions, user avatars, follow mode (one user's viewport follows another's), and idle detection. Awareness state propagates via the YJS awareness protocol.

## Asset System

Assets (images, media) are uploaded to S3-compatible storage (SeaweedFS in development). The server generates thumbnails and previews on upload. Assets are referenced by ID in the deck JSON — `deck-image` and `deck-slide` backgrounds resolve asset IDs to URLs at render time.

Asset URLs are proxied through the server with auth headers, so web components can load images without needing direct S3 access.

## Presentation Mode

Two presentation viewers share a `usePresentationPlayer` hook:

- **Authenticated** — Launched from the editor, uses live YDoc state
- **Public** — Standalone page for shared decks, fetches deck JSON via public API

Both support: slide transitions (defined by edges in the flow graph), component links (clicking a component navigates to a target slide), keyboard/click navigation, and scale-to-fit viewport rendering.
