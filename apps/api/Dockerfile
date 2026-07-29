# syntax=docker/dockerfile:1

ARG NODE_VERSION=24
ARG PNPM_VERSION=11.17.0
ARG TURBO_VERSION=2.10.7

FROM node:${NODE_VERSION}-bookworm-slim AS base
# ARG before FROM is not in stage scope — redeclare for corepack.
ARG PNPM_VERSION
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  bash \
  ca-certificates \
  openssl \
  curl \
  wget \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# Prune the monorepo to api + its workspace dependencies only.
FROM base AS prepare
ARG TURBO_VERSION
RUN npm install -g turbo@${TURBO_VERSION}
COPY . .
RUN turbo prune api --docker

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
# Prisma generate needs a syntactically valid URL; runtime uses real secrets.
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/survey?schema=public
ENV DIRECT_URL=postgresql://postgres:postgres@localhost:5432/survey?schema=public
COPY --from=prepare /app/out/full/ .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm --filter @workspace/database db:generate \
  && pnpm turbo build --filter=api...

# Portable production tree (prod deps + injected workspace packages).
# Symlink prisma/pg/@prisma/* from .pnpm so Node resolves them (migrate wait + API runtime).
FROM builder AS deploy
ENV HUSKY=0
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/survey?schema=public
ENV DIRECT_URL=postgresql://postgres:postgres@localhost:5432/survey?schema=public
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm --filter api deploy --prod --legacy /deploy \
  && mkdir -p /deploy/apps/api /deploy/packages/database/src \
  && cp -r /app/apps/api/dist /deploy/apps/api/dist \
  && cp /app/apps/api/docker-entrypoint.sh /deploy/apps/api/docker-entrypoint.sh \
  && cp /app/apps/api/docker-entrypoint.migrate.sh /deploy/apps/api/docker-entrypoint.migrate.sh \
  && test -f /app/packages/database/prisma/schema.prisma \
  && test -d /app/packages/database/prisma/migrations \
  && test -f /app/packages/database/prisma.config.ts \
  && test -d /app/packages/database/src/generated/prisma \
  && cp -r /app/packages/database/prisma /deploy/packages/database/prisma \
  && cp /app/packages/database/package.json /deploy/packages/database/package.json \
  && cp /app/packages/database/load-root-env.ts /deploy/packages/database/load-root-env.ts \
  && cp /app/packages/database/prisma.config.ts /deploy/packages/database/prisma.config.ts \
  && cp -r /app/packages/database/src/generated /deploy/packages/database/src/generated \
  && if [ -d /app/packages/database/dist ]; then cp -r /app/packages/database/dist /deploy/packages/database/dist; fi \
  && PRISMA_DIR="$(find /deploy/node_modules/.pnpm -type f -path '*/node_modules/prisma/package.json' | head -n 1 | sed 's|/package.json||')" \
  && if [ -z "$PRISMA_DIR" ]; then echo "prisma package missing from deploy tree" >&2; exit 1; fi \
  && test -f "$PRISMA_DIR/build/index.js" \
  && ln -sfn "${PRISMA_DIR#/deploy/node_modules/}" /deploy/node_modules/prisma \
  && PG_DIR="$(find /deploy/node_modules/.pnpm -type f -path '*/node_modules/pg/package.json' | head -n 1 | sed 's|/package.json||')" \
  && if [ -z "$PG_DIR" ]; then echo "pg missing from deploy tree (needed for migrate DB wait)" >&2; exit 1; fi \
  && ln -sfn "${PG_DIR#/deploy/node_modules/}" /deploy/node_modules/pg \
  && ADAPTER_DIR="$(find /deploy/node_modules/.pnpm -type f -path '*/node_modules/@prisma/adapter-pg/package.json' | head -n 1 | sed 's|/package.json||')" \
  && if [ -z "$ADAPTER_DIR" ]; then echo "@prisma/adapter-pg missing from deploy tree (needed for API runtime)" >&2; exit 1; fi \
  && CLIENT_DIR="$(find /deploy/node_modules/.pnpm -type f -path '*/node_modules/@prisma/client/package.json' | head -n 1 | sed 's|/package.json||')" \
  && if [ -z "$CLIENT_DIR" ]; then echo "@prisma/client missing from deploy tree" >&2; exit 1; fi \
  && mkdir -p /deploy/node_modules/@prisma \
  && ln -sfn "../${ADAPTER_DIR#/deploy/node_modules/}" /deploy/node_modules/@prisma/adapter-pg \
  && ln -sfn "../${CLIENT_DIR#/deploy/node_modules/}" /deploy/node_modules/@prisma/client \
  && DOTENV_DIR="$(find /deploy/node_modules/.pnpm -type f -path '*/node_modules/dotenv/package.json' | head -n 1 | sed 's|/package.json||')" \
  && if [ -z "$DOTENV_DIR" ]; then echo "dotenv missing from deploy tree" >&2; exit 1; fi \
  && ln -sfn "${DOTENV_DIR#/deploy/node_modules/}" /deploy/node_modules/dotenv \
  && ENGINE_BIN="$(find /deploy/node_modules -type f \( -name 'schema-engine*' -o -name 'schema-engine' \) ! -name '*.exe' -print -quit 2>/dev/null)" \
  && if [ -z "$ENGINE_BIN" ]; then echo "Prisma schema-engine binary missing from deploy tree" >&2; exit 1; fi \
  && echo "Found schema-engine at $ENGINE_BIN" \
  && mkdir -p /deploy/node_modules/.bin \
  && printf '%s\n' '#!/bin/sh' 'exec node /app/node_modules/prisma/build/index.js "$@"' > /deploy/node_modules/.bin/prisma \
  && chmod +x /deploy/node_modules/.bin/prisma /deploy/apps/api/docker-entrypoint.sh /deploy/apps/api/docker-entrypoint.migrate.sh \
  && test -f /deploy/packages/database/prisma/schema.prisma \
  && test -d /deploy/packages/database/prisma/migrations \
  && test -f /deploy/packages/database/prisma.config.ts \
  && ( test -f /deploy/packages/database/src/generated/prisma/client.js \
  || test -f /deploy/packages/database/src/generated/prisma/client.ts ) \
  && cd /deploy/packages/database \
  && node /deploy/node_modules/prisma/build/index.js -v

FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  bash \
  ca-certificates \
  openssl \
  curl \
  wget \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nestjs

COPY --from=deploy --chown=nestjs:nodejs /deploy /app

EXPOSE 4000
USER nestjs

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/live || exit 1

ENTRYPOINT ["sh", "/app/apps/api/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
