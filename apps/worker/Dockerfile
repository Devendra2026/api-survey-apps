# syntax=docker/dockerfile:1

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.33.4
ARG TURBO_VERSION=2.10.5

FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl wget \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# Prune the monorepo to worker + its workspace dependencies only.
FROM base AS prepare
ARG TURBO_VERSION
RUN npm install -g turbo@${TURBO_VERSION}
COPY . .
RUN turbo prune worker --docker

FROM base AS deps
ENV CI=true
# out/json includes package.json files, pnpm-lock.yaml, pnpm-workspace.yaml
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

FROM deps AS builder
ENV CI=true
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/survey?schema=public
ENV DIRECT_URL=postgresql://postgres:postgres@localhost:5432/survey?schema=public
COPY --from=prepare /app/out/full/ .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm --filter @workspace/database db:generate \
  && pnpm turbo build --filter=worker... \
  && pnpm --filter worker exec playwright install --with-deps chromium

FROM node:${NODE_VERSION}-bookworm-slim AS runner
ARG PNPM_VERSION=10.33.4
WORKDIR /app
ENV NODE_ENV=production
ENV WORKER_PORT=4001
ENV HOSTNAME=0.0.0.0
ENV PLAYWRIGHT_BROWSERS_PATH=/home/worker/.cache/ms-playwright

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  ca-certificates curl wget \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 \
  libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2 libpango-1.0-0 libcairo2 \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@${PNPM_VERSION} --activate \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 worker

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/worker/package.json ./apps/worker/
COPY --from=builder --chown=worker:nodejs /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=worker:nodejs /app/packages ./packages
COPY --from=builder --chown=worker:nodejs /root/.cache/ms-playwright /home/worker/.cache/ms-playwright
RUN chown -R worker:nodejs /app /home/worker/.cache

EXPOSE 4001
USER worker

HEALTHCHECK --interval=20s --timeout=5s --start-period=90s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4001/live || exit 1

# Equivalent to: pnpm --filter worker start → node dist/main.js
CMD ["pnpm", "--filter", "worker", "start"]
