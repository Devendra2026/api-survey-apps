# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable && corepack prepare pnpm@10.33.4 --activate
WORKDIR /app

FROM base AS builder
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/survey?schema=public
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/database db:generate
RUN pnpm --filter @workspace/database build
RUN pnpm --filter api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl wget
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/packages/database ./packages/database
COPY --from=builder --chown=nestjs:nodejs /app/packages/typescript-config ./packages/typescript-config
COPY apps/api/docker-entrypoint.sh /app/apps/api/docker-entrypoint.sh
COPY apps/api/docker-entrypoint.migrate.sh /app/apps/api/docker-entrypoint.migrate.sh
RUN chmod +x /app/apps/api/docker-entrypoint.sh /app/apps/api/docker-entrypoint.migrate.sh && chown -R nestjs:nodejs /app

EXPOSE 4000
WORKDIR /app/apps/api
USER nestjs
ENTRYPOINT ["sh", "/app/apps/api/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
