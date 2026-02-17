# Stable

AI-driven QA bot that autonomously navigates web applications, discovers user journeys, and detects regressions.

## How It Works

Stable takes a URL, launches a headless browser, and uses an LLM to explore the application like a human user would. It:

1. **Snapshots** the page's accessibility tree (compact text representation with element refs)
2. **Sends** the snapshot to an LLM which decides what to do next
3. **Executes** the action via Chrome DevTools Protocol (click, type, scroll, navigate)
4. **Records** each step (snapshot, action, screenshot) as part of a user journey
5. **Repeats** until the app is thoroughly explored

This follows the OpenClaw-style approach: accessibility tree snapshots + element refs instead of screenshots or DOM parsing. ~90% fewer tokens, no vision required from the LLM, more reliable than coordinate-based clicking.

## Quick Start

```bash
# Clone and install
pnpm install

# Configure (copy and edit)
cp .env.example .env
# Set your LLM_API_KEY or ANTHROPIC_API_KEY

# Start dev server
pnpm dev

# Trigger an exploration
curl -X POST http://localhost:3000/api/v1/runs \
  -H "Content-Type: application/json" \
  -d '{"targetUrl": "https://example.com"}'
```

## Docker

```bash
docker compose up --build
```

## Tech Stack

- **Browser**: Chrome DevTools Protocol (CDP) direct — not Playwright
- **LLM**: Provider-agnostic (Anthropic, OpenAI, or any OpenAI-compatible API)
- **Database**: PGlite (in-process WASM Postgres) via Drizzle ORM
- **API**: Fastify
- **Linting**: Oxlint (VoidZero)
- **Formatting**: Oxfmt (VoidZero)

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with hot reload |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run oxlint |
| `pnpm format` | Format code with oxfmt |
| `pnpm check` | Run all checks (typecheck + lint + format) |
| `pnpm test` | Run tests in watch mode |
| `pnpm test:run` | Run tests once |
| `pnpm db:generate` | Generate migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations |

## API

```
POST /api/v1/runs          # Start an exploration { targetUrl, config? }
GET  /api/v1/runs          # List runs
GET  /api/v1/runs/:id      # Get run details with journeys and steps
GET  /health               # Health check
```

## License

MIT
