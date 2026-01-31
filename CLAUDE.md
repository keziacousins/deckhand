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

# Run tests across all workspaces
npm run test

# Run tests in a specific package
npm run test --workspace=packages/schema

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

**Key design decisions:**
- Documents use objects keyed by ID (not arrays) for efficient CRDT sync
- Web components use Shadow DOM for complete style isolation from editor UI
- Canvas (React Flow) is for visualization/navigation only; content editing happens via LLM tools or contenteditable in preview
- JSON is the source of truth (no YAML layer)

## Reference Code

The `reference-code/` directory contains code from ProcessFactory Studio that this project draws patterns from. It's excluded from TypeScript compilation and is for reference only.

## Working Guidelines

- Do not start dev servers (`npm run dev`, `npm run dev:server`, `npm run dev:all`). The user manages their own dev environment.
- Do not commit or perform git operations without explicit user permission.
