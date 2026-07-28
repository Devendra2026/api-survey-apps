# Dokploy Turborepo Deployment Hardening — Design

**Date:** 2026-07-28  
**Status:** Approved for implementation

## Problem

Dokploy / Nixpacks builds the monorepo root. Root [`nixpacks.toml`](../../../nixpacks.toml) intentionally fails with:

> ERROR: Do not deploy the monorepo root with Nixpacks.

That prevents a broken Swarm `0/1` + Traefik 502 (no healthy process), but operators need a clear, dual-path production deploy that never requires changing the repo again after a fresh clone.

## Goals

1. Keep Turborepo + pnpm workspaces for local development.
2. Keep root Nixpacks fail-fast (do not make root a runnable app).
3. Make **Compose + Dockerfiles** and **three Nixpacks apps** equally first-class.
4. Each of `web`, `api`, `worker` builds independently with workspace deps.
5. Document everything in root `DEPLOYMENT.md`.

## Non-goals

- Removing Turborepo
- Root `start` that runs all apps
- Changing application business logic
- Leaving pnpm workspaces

## Architecture

```
Repo root (workspace only)
├── nixpacks.toml          # fail-fast if misused as Nixpacks root
├── docker-compose.dokploy.yml
├── apps/web/{Dockerfile,nixpacks.toml}
├── apps/api/{Dockerfile,nixpacks.toml,docker-entrypoint*.sh}
├── apps/worker/{Dockerfile,nixpacks.toml}
└── packages/*             # shared libs (database, validation, etl-core, …)
```

### Deploy path A — Compose (Dokploy)

One Compose application using `docker-compose.dokploy.yml`:

- Infra: postgres, redis, minio (+ minio-init)
- App: migrate → api + worker + web
- Builds: `apps/*/Dockerfile` with context = repository root

### Deploy path B — Nixpacks (three Applications)

For each app, Dokploy Application with:

- Build context = repository root
- Env: `NIXPACKS_CONFIG_FILE=apps/<web|api|worker>/nixpacks.toml`
- Ports: web 3000, api 4000, worker 4001

## Nixpacks design

- Node 22 via `NIXPACKS_NODE_VERSION`
- pnpm from root `packageManager` (`pnpm@10.33.4`)
- Explicit `[phases.build].cmds` **without** `"..."` so the Node provider does not also run a root-wide `turbo build`
- Start via package scripts: `pnpm --filter <app> start`
- api/worker: Prisma `db:generate` before turbo build; dummy `DATABASE_URL`/`DIRECT_URL` at build time
- worker: Playwright Chromium install after build
- web: `NEXT_PUBLIC_*` must be present at **build** time in Dokploy

## Docker design (`turbo prune --docker`)

Each Dockerfile:

1. **base** — Node 22 + corepack pnpm 10.33.4
2. **prepare** — copy repo, `turbo prune <app> --docker`
3. **deps** — install from `out/json/` + pruned lockfile
4. **builder** — copy `out/full/`, generate Prisma (api/worker), `pnpm turbo build --filter=<app>...`
5. **runner** — production artifacts only (web standalone; api/worker dist + packages)

## Scripts contract

| Package | build         | start                                       | dev                  |
| ------- | ------------- | ------------------------------------------- | -------------------- |
| web     | `next build`  | `next start --hostname 0.0.0.0 --port 3000` | `next dev …`         |
| api     | `nest build`  | `node dist/main.js`                         | `nest start --watch` |
| worker  | `nest build`  | `node dist/main.js`                         | `nest start --watch` |
| root    | `turbo build` | _(none)_                                    | filtered turbo       |

## Success criteria

- `pnpm install` + `turbo build` on a fresh clone
- Filtered builds: `--filter=web...` / `api...` / `worker...`
- Docker builds for all three Dockerfiles
- `docker compose -f docker-compose.dokploy.yml config` validates
- Root Nixpacks still fails without `NIXPACKS_CONFIG_FILE`
- Per-app Nixpacks configs are deployable with that env var set
