# Deckhand

LLM-first presentation authoring. Describe slides in natural language, and an AI builds them using structured components. Real-time multi-user collaboration via YJS.

## Prerequisites

- Node.js 20+
- Docker (for infrastructure services)
- An [Anthropic API key](https://console.anthropic.com/) for LLM features

## Getting Started

### 1. Start infrastructure

Docker Compose manages PostgreSQL, Ory Kratos/Hydra (auth), and SeaweedFS (object storage). The editor and server run natively.

```bash
cp .env.example .env          # adjust secrets for non-local use
docker compose up -d
```

### 2. Configure the server

```bash
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env — set ANTHROPIC_API_KEY at minimum
```

### 3. Install and run

```bash
npm install
npm run dev:all               # starts editor (Vite) + server (tsx watch)
```

The editor opens at `http://localhost:5178`.

## Project Structure

```
packages/schema       Zod schemas, types, mutation functions
packages/sync         YDoc/YJS diffing, patching, conversion
packages/components   Web components (Shadow DOM) for rendering slides
apps/editor           React + Vite frontend
apps/server           Express backend + WebSocket + LLM integration
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for design decisions and detailed system documentation.

## Development

```bash
npm run build         # build all packages
npm run test          # run unit tests across all workspaces
npm run typecheck     # type check all packages
npx playwright test   # E2E tests (requires dev servers running)
```

## How It Works

1. Users chat with the LLM, describing what they want on their slides
2. The LLM calls structured tools (add_slide, update_component, etc.) that produce JSON mutations
3. Mutations are diffed and applied to a YDoc, which syncs to all connected clients in real time
4. Web components with Shadow DOM render the slides identically in the editor, presentation mode, and public sharing

The LLM and manual edits follow the same mutation path — they're peers, not separate systems.

## Built With

- [React Flow](https://reactflow.dev/) — spatial canvas for slide arrangement and navigation flow editing
- [YJS](https://yjs.dev/) — CRDT framework for real-time collaboration, sync, and undo
- [Anthropic Claude SDK](https://docs.anthropic.com/en/api/client-sdks) — LLM-powered slide authoring via structured tool use
- [Zod](https://zod.dev/) — schema validation underpinning the entire type contract
- [Ory Kratos](https://www.ory.sh/kratos/) + [Hydra](https://www.ory.sh/hydra/) — identity management and OAuth2
- [Marked](https://marked.js.org/) — markdown rendering in slide text components
- [Mermaid](https://mermaid.js.org/) — diagram rendering
- [KaTeX](https://katex.org/) — math typesetting

## License

[MIT](LICENSE)
