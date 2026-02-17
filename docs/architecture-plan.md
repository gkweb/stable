# Stable - AI-Driven QA Bot: Repository Initialization Plan

## Context

We're initializing a greenfield project called **Stable** - an AI-driven QA bot that autonomously navigates web applications, discovers user journeys, and detects regressions. The repo is completely empty (no commits). This plan covers the initial scaffold (Phase 1 MVP foundation) to get an end-to-end flow working.

The core value proposition: instead of manually writing E2E tests, Stable takes a URL, explores the app using an LLM-powered browser agent, records what it finds, and on subsequent runs detects when things break.

**Key inspiration**: OpenClaw's browser automation approach - using Chrome DevTools Protocol (CDP) directly for speed, and accessibility tree snapshots (not screenshots or raw DOM) for LLM navigation. This is the proven pattern: snapshot -> LLM decides using element refs -> act on ref -> re-snapshot.

---

## Architecture Overview

**Core Loop**: Accessibility Snapshot -> LLM decides (using element refs) -> CDP executes action -> Record step -> Re-snapshot

This follows the OpenClaw pattern: the browser's accessibility tree is extracted as a compact, semantic snapshot. Each interactive element gets a ref ID (`@e1`, `@e2`). The LLM reads the snapshot, decides which element to interact with by ref, and the browser executes via CDP. This is:

- **90% fewer tokens** than screenshots (~280 chars vs ~8,000+ from Playwright MCP)
- **Faster** than Playwright (CDP eliminates the Node.js middleware hop, ~100μs round-trips)
- **More reliable** than coordinate-based clicking (refs are semantic, not pixel-dependent)
- **Vision not required** from the LLM (any model with tool use works, not just vision models)

| Layer              | Technology                                | Rationale                                                                                                          |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Language           | TypeScript (strict)                       | Type safety; good SDK coverage across LLM providers                                                                |
| Runtime            | Node.js 20 LTS                            | Stable; CDP WebSocket support built-in                                                                             |
| Browser Control    | **Chrome DevTools Protocol (CDP)** direct | Direct WebSocket to Chromium; ~15-20% faster than Playwright; same approach as OpenClaw, Browser Use, Stagehand v3 |
| Page Understanding | **Accessibility tree snapshots**          | Compact semantic representation with element refs; ~90% fewer tokens than screenshots; proven by OpenClaw          |
| AI/LLM             | **Provider-agnostic** (see below)         | Pluggable provider interface; vision NOT required (text snapshots)                                                 |
| HTTP API           | Fastify                                   | Fast; built-in validation; TypeScript-first                                                                        |
| Job Queue          | BullMQ + Redis                            | Persistent jobs; retry; cron scheduling; progress tracking                                                         |
| Storage            | SQLite via `better-sqlite3`               | Zero-dep for MVP; file-based; migrates to Postgres later                                                           |
| Screenshot Diff    | `pixelmatch` + `pngjs`                    | For regression comparison (not navigation)                                                                         |
| Container          | Docker (Chromium + Node)                  | Lightweight; only need Chromium, not full Playwright                                                               |
| Build              | `tsup` (esbuild)                          | Fast TS compilation                                                                                                |
| Package Manager    | pnpm                                      | Fast; disk-efficient; strict resolution                                                                            |
| Test Runner        | vitest                                    | Fast; native ESM/TS                                                                                                |

### Accessibility Snapshot Navigation (OpenClaw-style)

The agent navigates using semantic snapshots from the browser's accessibility tree:

1. **Snapshot** the accessibility tree via CDP (`Accessibility.getFullAXTree` or similar)
2. **Transform** into a compact text representation with element refs:
   ```
   [page] "Dashboard - MyApp"
     [nav] "Main navigation"
       [@e1] link "Home" href=/
       [@e2] link "Settings" href=/settings
       [@e3] link "Profile" href=/profile
     [@e4] button "Create New Project"
     [@e5] textbox "Search projects..."
     [table] "Projects"
       [@e6] link "Project Alpha"
       [@e7] link "Project Beta"
   ```
3. **Send to LLM** as text (cheap, fast, no vision needed)
4. **LLM decides**: `click @e4` or `fill @e5 "search term"` or `navigate /settings`
5. **Resolve ref** to CDP node, execute action via CDP (`DOM.focus`, `Input.dispatchMouseEvent`, etc.)
6. **Wait** for page to settle (CDP `Page.loadEventFired`, network idle)
7. **Record** the step (snapshot, action, URL, optional screenshot for baseline)
8. **Re-snapshot** (refs are invalidated on DOM changes)

This means:

- **Any LLM with tool use works** - no vision capability required
- Actions are **ref-based** (semantic) not coordinate-based or selector-based
- Token cost is minimal - a full page snapshot is often under 500 chars
- Screenshots are captured **optionally** for regression baselines, not for navigation

### CDP vs Playwright

We use CDP directly (via `chrome-remote-interface` or raw WebSocket) instead of Playwright because:

- **Speed**: Direct WebSocket, no Node.js server middleware hop (~100μs vs ~1ms round-trips)
- **Control**: Full access to all CDP domains (Accessibility, DOM, Input, Network, Page, Runtime)
- **Industry trend**: OpenClaw, Browser Use, and Stagehand v3 all moved from Playwright to CDP
- **Lighter Docker image**: Just need Chromium binary, not full Playwright installation
- **Future**: Playwright test export becomes a feature (convert recorded journeys to `.spec.ts` files)

### LLM Provider Architecture

The LLM layer is built around a `LLMProvider` interface. Since navigation uses text snapshots (not screenshots), **vision support is NOT required** - any model with tool use works.

```typescript
// src/llm/types.ts - Provider-agnostic types
interface LLMProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
  supportsToolUse(): boolean;
  name: string;
}

interface ChatRequest {
  systemPrompt: string;
  messages: ChatMessage[]; // Text content (snapshots); images only for optional screenshot capture
  tools?: ToolDefinition[]; // JSON Schema based, provider-neutral
  temperature?: number;
  maxTokens?: number;
}

interface ChatResponse {
  content: string | null;
  toolCalls: ToolCall[]; // Normalized tool calls
  usage: { inputTokens: number; outputTokens: number };
  stopReason: 'end' | 'tool_use' | 'max_tokens';
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema; // Standard JSON Schema - works across all providers
}
```

**Shipped providers (MVP)**:

- `AnthropicProvider` - Claude models via `@anthropic-ai/sdk`
- `OpenAIProvider` - GPT/o-series models via `openai` SDK (also covers Azure OpenAI)

**Easy to add later**:

- `GoogleProvider` - Gemini via `@google/generative-ai`
- `OllamaProvider` - Local models via Ollama REST API
- Any OpenAI-compatible API (Groq, Together, etc.) works via `OpenAIProvider` with a custom `baseURL`

**Configuration**: Provider is selected via `LLM_PROVIDER` env var (default: `anthropic`), model via `LLM_MODEL`. Each provider has its own env vars for API keys/endpoints.

---

## Project Structure

```
stable/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
│
├── src/
│   ├── index.ts                    # Entry point: starts API server + worker
│   │
│   ├── config/
│   │   ├── index.ts                # Centralized config from env vars
│   │   └── schema.ts              # Zod schema for config validation
│   │
│   ├── server/                     # Fastify HTTP API
│   │   ├── index.ts               # App factory
│   │   ├── routes/
│   │   │   ├── runs.ts            # POST /runs, GET /runs/:id
│   │   │   └── health.ts          # GET /health
│   │   └── middleware/
│   │       └── auth.ts            # API key verification
│   │
│   ├── agent/                      # Core AI agent logic
│   │   ├── index.ts               # Agent orchestrator (main loop: snapshot -> LLM -> action -> repeat)
│   │   ├── explorer.ts            # Exploration strategy
│   │   ├── action-executor.ts     # Resolves refs -> CDP actions
│   │   ├── journey-recorder.ts    # Records steps into Journey structure
│   │   ├── memory.ts              # Visited URLs, action history, loop prevention
│   │   └── types.ts               # Agent types (Action, PageState, Decision)
│   │
│   ├── browser/                    # CDP browser control layer
│   │   ├── index.ts               # Browser lifecycle: launch Chromium, CDP connection
│   │   ├── snapshot.ts            # Accessibility tree extraction + ref assignment
│   │   ├── actions.ts             # CDP actions: click ref, fill ref, scroll, navigate
│   │   ├── screenshot.ts          # Screenshot capture via CDP (for baselines, not navigation)
│   │   ├── network-monitor.ts     # CDP Network domain: intercept API calls
│   │   └── console-monitor.ts     # CDP Runtime domain: capture console errors
│   │
│   ├── llm/                        # LLM integration (provider-agnostic)
│   │   ├── index.ts               # Provider factory + registry
│   │   ├── types.ts               # LLMProvider interface, ChatRequest/Response, ToolDefinition
│   │   ├── providers/
│   │   │   ├── anthropic.ts       # Anthropic (Claude) adapter
│   │   │   ├── openai.ts          # OpenAI adapter - also covers Azure, Groq, etc.
│   │   │   └── index.ts           # Provider registry + factory
│   │   ├── prompts/
│   │   │   └── exploration.ts     # Exploration system prompt
│   │   └── tools/                  # Tool definitions (JSON Schema, provider-neutral)
│   │       ├── click.ts           # Click element by ref (@e1)
│   │       ├── fill.ts            # Fill text input by ref
│   │       ├── select.ts          # Select dropdown option by ref
│   │       ├── scroll.ts          # Scroll the page
│   │       ├── navigate.ts        # Go to a URL directly
│   │       ├── wait.ts            # Wait for page to settle
│   │       ├── mark-journey.ts    # Mark current journey complete, start new one
│   │       └── done.ts            # Signal exploration is complete
│   │
│   ├── baseline/                   # Baseline storage & regression detection (future phase, stubs only)
│   │   └── index.ts               # Stub for baseline manager
│   │
│   ├── storage/                    # Persistence layer
│   │   ├── database.ts            # SQLite connection + migration runner
│   │   ├── migrations/
│   │   │   └── 001-init.sql       # Initial schema
│   │   ├── models/
│   │   │   ├── run.ts
│   │   │   ├── journey.ts
│   │   │   └── step.ts
│   │   └── artifacts.ts           # File-based artifact storage (screenshots)
│   │
│   └── shared/                     # Shared utilities
│       ├── logger.ts              # Structured logger (pino)
│       ├── errors.ts              # Custom error classes
│       ├── id.ts                  # ID generation (nanoid)
│       └── types.ts               # Shared types
│
├── data/                           # Persisted data (Docker volume)
│   ├── stable.db
│   └── artifacts/
│
└── tests/
    ├── unit/
    └── fixtures/
```

---

## What Gets Built in This Init

This init focuses on **Phase 1: MVP Foundation** - getting a working end-to-end flow:

### Files to create (in order):

1. **Project config**: `package.json`, `tsconfig.json`, `tsup.config.ts`, `.gitignore`, `.env.example`
2. **Config module**: `src/config/schema.ts`, `src/config/index.ts`
3. **Shared utilities**: `src/shared/logger.ts`, `src/shared/errors.ts`, `src/shared/id.ts`, `src/shared/types.ts`
4. **Storage layer**: `src/storage/database.ts`, `src/storage/migrations/001-init.sql`, `src/storage/models/run.ts`, `src/storage/models/journey.ts`, `src/storage/models/step.ts`, `src/storage/artifacts.ts`
5. **Browser module (CDP)**: `src/browser/index.ts`, `src/browser/snapshot.ts`, `src/browser/actions.ts`, `src/browser/screenshot.ts`
6. **LLM integration**: `src/llm/types.ts`, `src/llm/providers/anthropic.ts`, `src/llm/providers/openai.ts`, `src/llm/providers/index.ts`, `src/llm/index.ts`, `src/llm/tools/*.ts`, `src/llm/prompts/exploration.ts`
7. **Agent core**: `src/agent/types.ts`, `src/agent/memory.ts`, `src/agent/action-executor.ts`, `src/agent/journey-recorder.ts`, `src/agent/explorer.ts`, `src/agent/index.ts`
8. **API server**: `src/server/index.ts`, `src/server/routes/runs.ts`, `src/server/routes/health.ts`
9. **Entry point**: `src/index.ts`
10. **Docker**: `Dockerfile`, `docker-compose.yml`
11. **README**: Project overview and getting started

### Key Design Decisions

**Accessibility Snapshot Navigation (OpenClaw-style)**: The LLM navigates using compact text snapshots from the browser's accessibility tree. Each interactive element gets a ref ID (`@e1`, `@e2`). The LLM reads the snapshot and decides which ref to interact with. ~90% fewer tokens than screenshots, no vision required from the LLM, more reliable than coordinate-based clicking.

**CDP Direct (not Playwright)**: Chrome DevTools Protocol via direct WebSocket connection. ~15-20% faster than Playwright. Same approach OpenClaw, Browser Use, and Stagehand v3 converged on. Full control over Accessibility, DOM, Input, Network, Page, and Runtime domains. Lighter Docker image (just Chromium, not full Playwright).

**Provider-Agnostic LLM Layer**: The `LLMProvider` interface abstracts all LLM interaction. Tool definitions use standard JSON Schema. Swap providers via `LLM_PROVIDER` + `LLM_MODEL` env vars. Since we use text snapshots (not screenshots), **any model with tool use works** - no vision requirement. OpenAI-compatible APIs (Groq, Together, Ollama, Azure) all work through the OpenAI adapter with a custom `LLM_BASE_URL`.

**Ref-Based Actions**: Tools are defined around element refs:

- `click(ref)` - click element by ref
- `fill(ref, text)` - fill a text input
- `select(ref, value)` - select dropdown option
- `scroll(direction, amount)` - scroll the viewport
- `navigate(url)` - go to a URL directly
- `wait()` - wait for page to settle
- `mark_journey(name, description)` / `done()` - journey lifecycle

**Exploration Memory**: Tracks visited URLs, action history, and snapshot hashes to prevent infinite loops and ensure systematic coverage.

**Screenshots for Baselines Only**: Screenshots are captured via CDP `Page.captureScreenshot` but only for recording baselines for future regression comparison - not used for navigation.

**Sync Jobs for MVP**: Jobs run synchronously in-process. BullMQ/Redis queue integration is a future phase.

---

## Database Schema

```sql
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|running|completed|failed
  mode TEXT NOT NULL DEFAULT 'explore',    -- explore|regression
  baseline_id TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  config TEXT,          -- JSON
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  summary TEXT          -- JSON: {journeyCount, stepCount, errorsFound, etc.}
);

CREATE TABLE journeys (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE steps (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journeys(id),
  sequence INTEGER NOT NULL,
  action_type TEXT NOT NULL,        -- click|fill|select|scroll|navigate|wait|mark_journey|done
  action_params TEXT NOT NULL,      -- JSON: {ref, text} for fill, {ref} for click, {url} for navigate, etc.
  snapshot_before TEXT,             -- Accessibility snapshot before this action
  page_url TEXT NOT NULL,
  page_title TEXT,
  screenshot_path TEXT,             -- Optional screenshot (for baselines)
  console_log TEXT,                 -- JSON: console messages during this step
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Baseline/snapshot/diff tables will be added in the regression detection phase.

---

## API Endpoints (MVP)

```
POST   /api/v1/runs              # Trigger exploration run { targetUrl, config? }
GET    /api/v1/runs              # List runs
GET    /api/v1/runs/:id          # Get run details + journeys + steps
GET    /health                   # Health check
```

Full webhook/scheduling/baseline endpoints come in later phases.

---

## Docker Setup

- **Dockerfile**: Multi-stage build. Builder: Node alpine. Production: Debian slim + Chromium binary
- **docker-compose.yml**: `stable` service + `redis` service (for future queue), shared volume for data
- No Playwright installation needed - just `chromium-browser` package + `chrome-remote-interface` npm package

---

## Environment Variables

```
# LLM Provider (provider-agnostic)
LLM_PROVIDER=anthropic              # anthropic | openai
LLM_MODEL=claude-sonnet-4-5-20250929  # Model ID (provider-specific)
LLM_BASE_URL=                       # Optional: custom endpoint (for Azure, Groq, Ollama, etc.)
LLM_API_KEY=                        # API key for the selected provider

# Provider-specific keys (used when LLM_API_KEY is not set)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Server
PORT=3000
HOST=0.0.0.0
API_KEY=                            # Optional: protect API with bearer token

# Redis (for future queue/scheduling)
REDIS_URL=redis://localhost:6379

# Storage
DATA_DIR=./data

# Agent defaults
MAX_JOURNEYS=10
MAX_STEPS_PER_JOURNEY=50
MAX_DURATION_MINUTES=30

# Browser
BROWSER_VIEWPORT_WIDTH=1280
BROWSER_VIEWPORT_HEIGHT=720
CHROMIUM_PATH=                      # Optional: path to Chromium binary (auto-detected if not set)

# Logging
LOG_LEVEL=info
```

---

## Key Dependencies

```
# Core
chrome-remote-interface             # CDP client (direct WebSocket to Chromium)
fastify                             # HTTP API
better-sqlite3                      # SQLite storage
zod                                 # Config/input validation
nanoid                              # ID generation
pino / pino-pretty                  # Structured logging

# LLM providers
@anthropic-ai/sdk                   # Anthropic adapter
openai                              # OpenAI adapter (also Azure, Groq, etc.)

# Regression (used for baseline comparison, not navigation)
pixelmatch / pngjs                  # Screenshot diffing

# Dev
typescript / tsup / tsx             # Build toolchain
vitest                              # Testing
@types/node / @types/better-sqlite3 # Type definitions
```

---

## Future Phases (not in this init)

- **Regression detection**: Baseline creation, screenshot diffing, semantic comparison via LLM
- **Playwright test export**: Convert recorded journeys into runnable `.spec.ts` files
- **Queue integration**: BullMQ workers for async job execution
- **Webhooks**: GitHub/GitLab CI triggers
- **Scheduling**: Cron-based recurring runs
- **Auth support**: Cookie injection, form login flows
- **Accessibility checking**: WCAG compliance during exploration

---

## Verification

After implementation:

1. `pnpm install` succeeds
2. `pnpm typecheck` passes
3. `pnpm build` produces `dist/` output
4. `docker compose build` builds successfully
5. `docker compose up` starts the server on port 3000
6. `GET /health` returns 200
7. `POST /api/v1/runs` with a target URL enqueues and starts an exploration
