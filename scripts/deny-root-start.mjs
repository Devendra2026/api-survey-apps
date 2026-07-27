#!/usr/bin/env node
/**
 * Prevents accidental production starts from the monorepo root.
 * Deploy and start each runnable service independently (api, web, worker).
 */
console.error(`
[api-survey-apps] Refusing to start from the monorepo root.

Deploy each service separately:

  pnpm --filter api start      → NestJS API  (port 4000)
  pnpm --filter web start      → Next.js web (port 3000)
  pnpm --filter worker start   → BullMQ worker (port 4001)

See docs/ops/production-deployment.md
`)
process.exit(1)
