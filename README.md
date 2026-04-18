# Deckhand

LLM-first presentation authoring. Describe slides in natural language, and an AI builds them using structured components. Real-time multi-user collaboration via YJS.

## Deployment

Everything runs in Docker. A single `docker compose up -d` starts the full stack: app server, frontend, PostgreSQL, Ory Kratos/Hydra (auth), SeaweedFS (object storage), and nginx (TLS/reverse proxy).

### 1. Generate credentials

```bash
./scripts/generate-env.sh
```

This creates `.env` with random passwords and secrets for Postgres, S3-compatible storage, and Ory services.

### 2. Configure

Edit `.env` and set:
- `ANTHROPIC_API_KEY` — your [Anthropic API key](https://console.anthropic.com/)
- `PUBLIC_URL` — the public URL where users will access the app (e.g. `https://deck.example.com`)

### 3. TLS certificates

Place your TLS certificate and key at:
```
nginx/certs/cert.pem
nginx/certs/key.pem
```

For [Tailscale](https://tailscale.com/) hosts, generate certs with:
```bash
sudo tailscale cert --cert-file nginx/certs/cert.pem --key-file nginx/certs/key.pem your-hostname.ts.net
```

For public domains, use [certbot](https://certbot.eff.org/) or your preferred ACME client.

### 4. Start

```bash
docker compose up -d
```

The app will be available at your `PUBLIC_URL`.

## Development

### Prerequisites

- Node.js 23+
- Docker (for infrastructure services)

### Setup

Start only the infrastructure services (databases, auth, object storage):

```bash
./scripts/generate-env.sh
# Edit .env — set ANTHROPIC_API_KEY
docker compose up -d deckhand-postgres ory-postgres kratos hydra seaweedfs
```

Then install dependencies and run the dev servers:

```bash
npm install
npm run dev:all    # starts editor (Vite) + server (tsx watch)
```

The editor opens at `http://localhost:5178`.

### Commands

```bash
npm run build         # build all packages
npm run test          # run unit tests across all workspaces
npm run typecheck     # type check all packages
npx playwright test   # E2E tests (requires dev servers running)
```

## Project Structure

```
packages/schema       Zod schemas, types, mutation functions
packages/sync         YDoc/YJS diffing, patching, conversion
packages/components   Web components (Shadow DOM) for rendering slides
apps/editor           React + Vite frontend
apps/server           Express backend + WebSocket + LLM integration
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for design decisions and detailed system documentation.

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
