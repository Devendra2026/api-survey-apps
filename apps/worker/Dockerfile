# syntax=docker/dockerfile:1

# Stub image path for the future worker package.
# Replace this with the real worker build once apps/worker/package.json exists.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV WORKER_PORT=4001
RUN apk add --no-cache curl wget && addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker
USER worker
EXPOSE 4001
CMD ["node", "-e", "console.error('apps/worker is not implemented yet. Add a worker package and replace apps/worker/Dockerfile.'); process.exit(1)"]
