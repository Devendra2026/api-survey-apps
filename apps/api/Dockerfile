# syntax=docker/dockerfile:1

ARG NODE_VERSION=24
ARG PNPM_VERSION=11.17.0
ARG TURBO_VERSION=2.10.5

FROM node:${NODE_VERSION}-alpine AS base
# ARG before FROM is not in stage scope — redeclare for corepack.
ARG PNPM_VERSION
RUN apk add --no-cache libc6-compat \
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
FROM builder AS deploy
ENV HUSKY=0
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm --filter api deploy --prod --legacy /deploy \
  && mkdir -p /deploy/apps/api /deploy/packages/database/src \
  && cp -r /app/apps/api/dist /deploy/apps/api/dist \
  && cp /app/apps/api/docker-entrypoint.sh /deploy/apps/api/docker-entrypoint.sh \
  && cp /app/apps/api/docker-entrypoint.migrate.sh /deploy/apps/api/docker-entrypoint.migrate.sh \
  && cp -r /app/packages/database/prisma /deploy/packages/database/prisma \
  && cp /app/packages/database/package.json /deploy/packages/database/package.json \
  && cp /app/packages/database/load-root-env.ts /deploy/packages/database/load-root-env.ts \
  && if [ -d /app/packages/database/dist ]; then cp -r /app/packages/database/dist /deploy/packages/database/dist; fi \
  && if [ -d /app/packages/database/src/generated ]; then cp -r /app/packages/database/src/generated /deploy/packages/database/src/generated; fi \
  && if [ -f /app/packages/database/prisma.config.ts ]; then cp /app/packages/database/prisma.config.ts /deploy/packages/database/prisma.config.ts; fi \
  && PRISMA_DIR="$(find /deploy/node_modules/.pnpm -type f -path '*/node_modules/prisma/package.json' | head -n 1 | sed 's|/package.json||')" \
  && if [ -z "$PRISMA_DIR" ]; then echo "prisma package missing from deploy tree" >&2; exit 1; fi \
  && ln -sfn "${PRISMA_DIR#/deploy/node_modules/}" /deploy/node_modules/prisma \
  && TSX_DIR="$(find /deploy/node_modules/.pnpm -type f -path '*/node_modules/tsx/package.json' | head -n 1 | sed 's|/package.json||')" \
  && if [ -z "$TSX_DIR" ]; then echo "tsx missing from deploy tree (needed for catalog seed)" >&2; exit 1; fi \
  && ln -sfn "${TSX_DIR#/deploy/node_modules/}" /deploy/node_modules/tsx \
  && mkdir -p /deploy/node_modules/.bin \
  && printf '%s\n' '#!/bin/sh' 'exec node /app/node_modules/prisma/build/index.js "$@"' > /deploy/node_modules/.bin/prisma \
  && printf '%s\n' '#!/bin/sh' 'exec node /app/node_modules/tsx/dist/cli.mjs "$@"' > /deploy/node_modules/.bin/tsx \
  && chmod +x /deploy/node_modules/.bin/prisma /deploy/node_modules/.bin/tsx /deploy/apps/api/docker-entrypoint.sh /deploy/apps/api/docker-entrypoint.migrate.sh

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache curl wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=deploy --chown=nestjs:nodejs /deploy /app

EXPOSE 4000
USER nestjs

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/live || exit 1

ENTRYPOINT ["sh", "/app/apps/api/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
