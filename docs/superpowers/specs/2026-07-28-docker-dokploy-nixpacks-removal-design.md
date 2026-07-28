# Design: Nixpacks Removal → Docker-only Dokploy Compose

**Date:** 2026-07-28  
**Status:** Approved for implementation

## Goal

Completely remove Nixpacks from the monorepo and make Docker + Dokploy Compose the sole production deployment path.

## Decisions

| Topic                | Choice                                                             |
| -------------------- | ------------------------------------------------------------------ |
| Deploy topology      | One Dokploy Compose app via `docker-compose.dokploy.yml`           |
| Approach             | Harden existing per-app Dockerfiles (no docker-bake / shared base) |
| Toolchain            | Node 24 + pnpm 11; Turbo stays 2.10.x                              |
| Framework bumps      | No Next.js / React / TypeScript major upgrades                     |
| Web runtime          | Next.js `output: "standalone"` → `node apps/web/server.js`         |
| API / worker runtime | `node apps/<app>/dist/main.js` (no pnpm in runner images)          |

## Architecture

```
postgres + redis + minio
        ↓
     migrate (api image, one-shot prisma migrate deploy)
        ↓
   api (:4000) + worker (:4001)
        ↓
     web (:3000) → api
```

Build context for all images: **repository root**.

| Image           | Dockerfile               | Base                                 |
| --------------- | ------------------------ | ------------------------------------ |
| web             | `apps/web/Dockerfile`    | `node:24-alpine`                     |
| api (+ migrate) | `apps/api/Dockerfile`    | `node:24-alpine`                     |
| worker          | `apps/worker/Dockerfile` | `node:24-bookworm-slim` (Playwright) |

## Dockerfile pattern

```
base → prepare (turbo prune --docker) → deps → builder → runner
```

Optimizations:

- BuildKit cache mounts for pnpm store (and Next `.next/cache` on web)
- Install from `out/json/` before copying `out/full/`
- Dummy `DATABASE_URL` / `DIRECT_URL` only in builder for Prisma generate
- Non-root users (uid 1001)
- HEALTHCHECK on `/healthz` (web) or `/live` (api/worker)
- `exec`-style CMD / entrypoint for SIGTERM
- Final runners exclude turbo and (for api/worker) Corepack/pnpm

## Removed files

- `nixpacks.toml` (root)
- `apps/web/nixpacks.toml`
- `apps/api/nixpacks.toml`
- `apps/worker/nixpacks.toml`
- All docs / compose comments referencing Nixpacks, Railpack, or `NIXPACKS_*`

## Toolchain pins

- `.node-version`: `24`
- `package.json` `engines.node`: `>=24`
- `packageManager`: `pnpm@11.17.0` (or latest 11.x at implement time)
- Dockerfile `ARG NODE_VERSION=24`, `ARG PNPM_VERSION=11.17.0`
- Turbo: `2.10.5` (unchanged major)

## Dokploy instructions

1. Create a **Compose** application in Dokploy.
2. Compose file: `docker-compose.dokploy.yml`.
3. Build context: repository root (compose `build.context: .`).
4. Secrets: Dokploy Environment UI (primary); optional `.env.production` via `env_file.required: false`.
5. Domains (Traefik labels in compose):
   - `admin.sdvedutech.in` → web:3000
   - `backend.sdvedutech.in` → api:4000
6. Host ports: web `3001→3000`, api `4000`, worker `4001`.
7. Health: web `/healthz`, api/worker `/live`.
8. Web build args: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

## Validation checklist

- [x] `pnpm install` (Node 24 + pnpm 11)
- [x] `pnpm turbo build --filter=web... --filter=api... --filter=worker...`
- [x] `docker build -f apps/{web,api,worker}/Dockerfile .`
- [x] Health endpoints reachable when containers run (web `/healthz` smoke)
- [x] No remaining active `nixpacks` / `NIXPACKS_` / `railpack` deploy-path references (historical superseded spec excluded)

## Out of scope

- Next/React/TypeScript major upgrades
- docker-bake / shared Dockerfile base
- Remote Turbo cache
- Nest application logic changes beyond Dockerfile CMD/runtime
