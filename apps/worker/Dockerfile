# syntax=docker/dockerfile:1

ARG NODE_VERSION=24
ARG PNPM_VERSION=11.17.0
ARG TURBO_VERSION=2.10.7

FROM node:${NODE_VERSION}-bookworm-slim AS base
# ARG before FROM is not in stage scope — redeclare for corepack.
ARG PNPM_VERSION
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
ENV HUSKY=0
# out/json includes package.json files, pnpm-lock.yaml, pnpm-workspace.yaml
COPY --from=prepare /app/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

FROM deps AS builder
ENV CI=true
ENV HUSKY=0
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/survey?schema=public
ENV DIRECT_URL=postgresql://postgres:postgres@localhost:5432/survey?schema=public
COPY --from=prepare /app/out/full/ .
ENV PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=180000
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm --filter @workspace/database db:generate \
  && pnpm turbo build --filter=worker... \
  && pnpm --filter worker exec playwright install --with-deps chromium

# Portable production tree (prod deps + injected workspace packages).
FROM builder AS deploy
ENV HUSKY=0
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm --filter worker deploy --prod --legacy /deploy \
  && mkdir -p /deploy/apps/worker /deploy/packages/database/src \
  && cp -r /app/apps/worker/dist /deploy/apps/worker/dist \
  && if [ -d /app/packages/database/dist ]; then cp -r /app/packages/database/dist /deploy/packages/database/dist; fi \
  && if [ -d /app/packages/database/src/generated ]; then cp -r /app/packages/database/src/generated /deploy/packages/database/src/generated; fi \
  && cp /app/packages/database/package.json /deploy/packages/database/package.json

FROM node:${NODE_VERSION}-bookworm-slim AS runner
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
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 worker

COPY --from=deploy --chown=worker:nodejs /deploy /app
COPY --from=builder --chown=worker:nodejs /root/.cache/ms-playwright /home/worker/.cache/ms-playwright

EXPOSE 4001
USER worker

HEALTHCHECK --interval=20s --timeout=5s --start-period=90s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4001/live || exit 1

CMD ["node", "apps/worker/dist/main.js"]
