# CLAUDE.md

See `ARCHITECTURE.md` for project overview, design decisions, and system structure.

## Commands

```bash
# Start infrastructure for local dev (databases, auth, object storage)
docker compose up -d deckhand-postgres ory-postgres kratos hydra seaweedfs

# Install dependencies
npm install

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

# Type checking
npm run typecheck
```

## Testing

- Always use `npm run test`, never `npx vitest run` at the repo root — the latter picks up reference-code tests.
- Server tests require PostgreSQL. They skip gracefully when `DATABASE_URL` isn't set.
- Pre-existing TS errors in `apps/editor` (deck-slide children type, Inspector type) don't block the Vite build.

## Reference Code

The `reference-code/` directory contains code from another project that this project draws patterns from. It's excluded from TypeScript compilation and is for reference only.

## Production Hardening Principles

These principles apply to all new and modified code:

1. **No silent failures.** Every `catch` must log the error *and* propagate it (throw, return error, or reject). The only exception is graceful-degradation paths explicitly documented as best-effort.

2. **Async errors must be observable.** Never fire-and-forget an async operation. Use `await`, or attach a `.catch()`. If a promise is intentionally unhandled, comment why.

3. **Structured logging with context.** Log messages include `[Module]` prefix, deck/session IDs where available, and the operation being performed. Errors log the full error object, not just a message string.

4. **Fail-fast on corruption.** If data is invalid or missing where it shouldn't be, throw immediately rather than continuing with bad state.

5. **Clean up failed connections.** When a WebSocket send fails, remove that client from the session.

6. **Database operations that must be atomic should use transactions.**

7. **Centralized error handling at boundaries.** Express routes and WebSocket message handlers should have top-level try/catch. Interior code should throw, not catch-and-log.

8. **Timeouts and health signals.** Long-running operations should have explicit timeouts. The server exposes a health endpoint at `/api/health`.

## Working Guidelines

- Do not start dev servers (`npm run dev`, `npm run dev:server`, `npm run dev:all`). The user manages their own dev environment.
- Do not commit or perform git operations without explicit user permission.
