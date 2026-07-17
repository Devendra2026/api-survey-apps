# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable && corepack prepare pnpm@10.33.4 --activate
WORKDIR /app

FROM base AS builder
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/survey?schema=public
ENV DIRECT_URL=postgresql://postgres:postgres@localhost:5432/survey?schema=public
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/database db:generate
RUN pnpm turbo build --filter=worker...

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV WORKER_PORT=4001
RUN apk add --no-cache curl wget
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/worker/package.json ./apps/worker/
COPY --from=builder --chown=worker:nodejs /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=worker:nodejs /app/packages ./packages
RUN chown -R worker:nodejs /app

EXPOSE 4001
WORKDIR /app/apps/worker
USER worker
CMD ["node", "dist/main.js"]
