FROM node:22-alpine AS builder

RUN corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY packages/core/package.json packages/core/
COPY packages/provider-anthropic/package.json packages/provider-anthropic/
COPY packages/provider-openai/package.json packages/provider-openai/
COPY packages/provider-gemini/package.json packages/provider-gemini/
COPY packages/provider-openrouter/package.json packages/provider-openrouter/

RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY packages/ packages/
COPY apps/server/tsconfig.json apps/server/tsup.config.ts apps/server/drizzle.config.ts apps/server/
COPY apps/server/src/ apps/server/src/
COPY apps/server/drizzle/ apps/server/drizzle/

RUN pnpm build

# --- Production ---
FROM node:22-slim

# Install Chromium
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      libnss3 \
      libatk-bridge2.0-0 \
      libdrm2 \
      libxkbcommon0 \
      libgbm1 \
      libasound2 \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium

RUN corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY packages/core/package.json packages/core/
COPY packages/provider-anthropic/package.json packages/provider-anthropic/
COPY packages/provider-openai/package.json packages/provider-openai/
COPY packages/provider-gemini/package.json packages/provider-gemini/
COPY packages/provider-openrouter/package.json packages/provider-openrouter/

RUN pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

COPY --from=builder /app/apps/server/dist apps/server/dist/
COPY apps/server/drizzle/ apps/server/drizzle/

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "apps/server/dist/index.js"]
