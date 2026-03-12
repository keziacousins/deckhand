# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Deckhand is an LLM-first presentation authoring tool. Users describe slides in natural language, the LLM edits a structured JSON document, and web components render the slides. Real-time collaboration is powered by YJS/YDoc.

## Commands

```bash
# Install dependencies
npm install

# Development (runs editor frontend on Vite)
npm run dev

# Development (runs backend server with tsx watch)
npm run dev:server

# Run both editor and server concurrently
npm run dev:all

# Build all packages and apps
npm run build

# Run unit tests across all workspaces (NOT `npx vitest run` — that picks up reference-code)
npm run test

# Run unit tests in a specific workspace
npm run test -w packages/schema
npm run test -w packages/sync
npm run test -w packages/components
npm run test -w apps/server
# Note: apps/editor has no unit tests (only E2E via Playwright)

# Run E2E tests (Playwright) - requires dev servers running
npx playwright test

# Run specific E2E test file
npx playwright test tests/inspector.spec.ts

# Type checking
npm run typecheck

# Initialize database
npm run db:init --workspace=apps/server
```

## Architecture

**Monorepo structure using npm workspaces:**

- `packages/schema` - Zod schemas defining deck, slide, component, and theme structures. All document validation happens here.
- `packages/sync` - YDoc/YJS collaboration layer. Handles JSON diffing, patch generation, and YDoc conversion.
- `packages/components` - Vanilla web components (custom elements with Shadow DOM) for rendering slides. Framework-agnostic.
- `apps/editor` - React + Vite frontend with React Flow canvas for slide visualization and YJS client for real-time sync.
- `apps/server` - Express backend with WebSocket support for YJS, SQLite persistence via better-sqlite3.

**Data flow:**
1. LLM or user generates document changes
2. Changes validated against Zod schemas in `@deckhand/schema`
3. ID-based diffing in `@deckhand/sync` produces patches
4. Patches applied to YDoc, which syncs to all connected clients
5. Web components in `@deckhand/components` render the slide content

**Component model — 3 primitives:**
- `deck-text` — All text content. Plain string with opt-in `markdown: true` for GH-flavored markdown (via `marked`). Props: size, weight, align, transform, color.
- `deck-image` — Images from asset system. Props: assetId, fit, darken, blur, maxWidth/maxHeight, align, color (SVG fill).
- `deck-container` — Layout grouping. Grid mode (gridWidth sets span + internal columns) or floating mode (anchorX/anchorY for absolute positioning). Props: background, padding, gap, alignItems, justifyContent.
- Shared `VisualPropsSchema` on image + container: borderRadius (none/sm/md/lg/full/pill), borderWidth, borderColor, shadow (none/sm/md/lg), shadowColor.
- `CommonProperties` in `packages/components/src/types.ts` provides reusable inspector meta descriptors.

**Key design decisions:**
- Documents use objects keyed by ID (not arrays) for efficient CRDT sync
- Web components use Shadow DOM for complete style isolation from editor UI
- Canvas (React Flow) is for visualization/navigation only; content editing happens via LLM tools or contenteditable in preview
- JSON is the source of truth (no YAML layer)

## Testing

**Unit tests** use Vitest and are located in `__tests__` directories within each package:
- `packages/schema/src/__tests__/` - Schema and mutations tests (~290 tests)
- `packages/sync/src/__tests__/` - YDoc diffing/patching tests (~190 tests)
- `packages/components/src/__tests__/` - Web component tests with happy-dom (~80 tests)
- `apps/server/src/__tests__/` - API integration tests with in-memory SQLite (~28 tests)

**E2E tests** use Playwright and are in `tests/` at the project root:
- `tests/grid-layout.spec.ts` - CSS grid layout verification
- `tests/deck-operations.spec.ts` - Deck CRUD operations
- `tests/canvas.spec.ts` - React Flow canvas interactions
- `tests/inspector.spec.ts` - Inspector panel UI

## Reference Code

The `reference-code/` directory contains code from ProcessFactory Studio that this project draws patterns from. It's excluded from TypeScript compilation and is for reference only.

## Production Hardening Principles

These principles apply to all new and modified code:

1. **No silent failures.** Every `catch` must log the error *and* propagate it (throw, return error, or reject). A function that swallows an error and returns normally is lying to its caller. The only exception is graceful-degradation paths that are explicitly documented as best-effort.

2. **Async errors must be observable.** Never fire-and-forget an async operation (`void asyncFn()`, `.then()` with no `.catch()`). Use `await`, or attach a `.catch()` that logs and handles the failure. If a promise is intentionally unhandled, comment why.

3. **Structured logging with context.** Log messages include `[Module]` prefix, deck/session IDs where available, and the operation being performed. Errors log the full error object, not just a message string.

4. **Fail-fast on corruption.** If data is invalid or missing where it shouldn't be (e.g., YDoc produces null deck, DB write returns unexpected result), throw immediately rather than continuing with bad state. It's better to drop one operation loudly than corrupt data silently.

5. **Clean up failed connections.** When a WebSocket send fails, remove that client from the session. Don't leave dead clients in the set to fail again on every broadcast.

6. **Database operations that must be atomic should use transactions.** Multi-step DB writes (e.g., update content + save YDoc state) should be wrapped in a transaction so partial writes don't leave inconsistent state.

7. **Centralized error handling at boundaries.** Express routes and WebSocket message handlers should have top-level try/catch that logs and returns appropriate error responses. Interior code should throw, not catch-and-log.

8. **Timeouts and health signals.** Long-running operations (DB writes, external API calls) should have explicit timeouts. The server should expose a health endpoint that verifies DB connectivity.

## Working Guidelines

- Do not start dev servers (`npm run dev`, `npm run dev:server`, `npm run dev:all`). The user manages their own dev environment.
- Do not commit or perform git operations without explicit user permission.
