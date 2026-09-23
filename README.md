# API Survey Apps

Turborepo monorepo: Next.js web, NestJS API, BullMQ worker, Expo mobile, shared packages — production-ready for **Dokploy** (Docker Compose), **Docker Swarm**, and **Traefik**.

## Stack

| Path          | Role                                            |
| ------------- | ----------------------------------------------- |
| `apps/web`    | Next.js 16 admin UI (port **3000**)             |
| `apps/api`    | NestJS HTTP API (port **4000**)                 |
| `apps/worker` | BullMQ / PDF / ETL consumer (port **4001**)     |
| `apps/mobile` | Expo SDK 57 / React Native field client (Metro) |
| `packages/*`  | Shared libraries (not deployed alone)           |

The **repository root** only manages the workspace (`pnpm install`, `pnpm build`, DB scripts). It does **not** start application processes.

## Prerequisites

- Node.js 24+
- pnpm 12.5.1 (`corepack enable`)
- Docker (for Postgres / Redis / MinIO and production images)
- For Android mobile: Android Studio, Android SDK, an AVD/emulator, and `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) set in your shell — Expo discovers devices; do not hardcode emulator names in the repo

## Quick start (local)

```bash
pnpm install
cp .env.example .env.development
docker compose up -d                           # Postgres, Redis, MinIO, Mailpit
pnpm db:migrate
pnpm dev                                       # api + web + worker + mobile (Expo)
```

- Web: http://localhost:3000
- API live: http://localhost:4000/live
- Worker live: http://localhost:4001/live
- Mobile: Expo Metro (QR / press `a` in the Expo terminal, or use `pnpm mobile:android`)

### Mobile / Android

```bash
pnpm --filter mobile dev       # Expo server only
pnpm mobile:android            # Wait for booted emulator, then Expo --android
pnpm mobile:android:boot       # Boot/wait only (then press "a" if Metro already runs)
pnpm --filter mobile ios       # iOS simulator (macOS)
```

`pnpm mobile:android` cold-boots an AVD if needed and **waits until ADB is ready** before Expo connects (avoids `TCP port 5554` refused on Windows). Do not press `a` in Expo until the emulator home screen is up, or run `pnpm mobile:android:boot` first.

Android emulator networking: `localhost` on the emulator is not the host machine. Use `http://10.0.2.2:4000` for the Nest API (see [`deploy/env/mobile.env.example`](deploy/env/mobile.env.example) / `EXPO_PUBLIC_API_URL`). iOS simulator and Expo web can use `http://localhost:4000`.

If the emulator is stuck offline: kill `qemu-system-x86_64.exe`, run `adb kill-server && adb start-server`, then `pnpm mobile:android`. See [`apps/mobile/README.md`](apps/mobile/README.md).

## Production deployment (Dokploy)

**Full guide:** [`DEPLOYMENT.md`](DEPLOYMENT.md).

**Docker Compose only** ([`docker-compose.dokploy.yml`](docker-compose.dokploy.yml)). No root Dockerfile; Nixpacks is not used.

**Dokploy UI steps:** [`docs/ops/dokploy-compose-setup.md`](docs/ops/dokploy-compose-setup.md) — if you see `open Dockerfile: no such file or directory`, the app type is wrong (use Compose, do not add a root Dockerfile).

### One Compose application

1. Dokploy → new **Compose** application (build type = Docker Compose)
2. File: [`docker-compose.dokploy.yml`](docker-compose.dokploy.yml)
3. Build context = repository root
4. Env: paste into Dokploy **Environment** UI (Dokploy writes `.env`; see [`docs/ops/dokploy-env.md`](docs/ops/dokploy-env.md) and [`deploy/env/*.env.example`](deploy/env/))
5. Domains (Traefik labels included):
   - `admin.sdvedutech.in` → **web:3000**
   - `backend.sdvedutech.in` → **api:4000**
6. Each service builds from its **Dockerfile** (`turbo prune --docker`)

Ops detail: [`docs/ops/production-deployment.md`](docs/ops/production-deployment.md)

### Per-service Dockerfiles

```bash
docker build -f apps/api/Dockerfile -t api-survey-api:prod .
docker build -f apps/worker/Dockerfile -t api-survey-worker:prod .
docker build -f apps/web/Dockerfile -t api-survey-web:prod \
  --build-arg NEXT_PUBLIC_API_URL=https://backend.sdvedutech.in \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... .
```

| Service | Start inside image                     | Health     |
| ------- | -------------------------------------- | ---------- |
| api     | `node apps/api/dist/main.js`           | `/live`    |
| worker  | `node apps/worker/dist/main.js`        | `/live`    |
| web     | `node apps/web/server.js` (standalone) | `/healthz` |

All listen on `0.0.0.0`.

### Docker Swarm + Traefik

```bash
docker network create --driver=overlay --attachable traefik-public
docker stack deploy -c deploy/docker-stack.swarm.yml survey
```

See [`deploy/docker-stack.swarm.yml`](deploy/docker-stack.swarm.yml).

## Scripts

| Command                      | Description                                     |
| ---------------------------- | ----------------------------------------------- |
| `pnpm dev`                   | Watch mode: web + api + worker + mobile (Expo)  |
| `pnpm dev:mobile`            | Mobile Expo server only                         |
| `pnpm mobile:android`        | Boot emulator (wait ready) + Expo Android       |
| `pnpm mobile:android:boot`   | Boot/wait emulator only (Metro already running) |
| `pnpm mobile:ios`            | Expo + iOS simulator (macOS)                    |
| `pnpm build`                 | Turbo build all packages/apps                   |
| `pnpm --filter api start`    | Production API                                  |
| `pnpm --filter web start`    | Production Next.js                              |
| `pnpm --filter worker start` | Production worker                               |
| `pnpm db:deploy`             | Prisma migrate deploy                           |

## Environment

- [`.env.example`](.env.example) — copy to `.env.development` for local work
- `deploy/env/api.env.example`
- `deploy/env/web.env.example`
- `deploy/env/worker.env.example`
- `deploy/env/mobile.env.example` — public `EXPO_PUBLIC_*` only (no secrets)

## Ops docs

- [**DEPLOYMENT.md**](DEPLOYMENT.md) — structure, local, Dokploy Compose, Docker, env, troubleshooting
- [Production / Dokploy / Traefik](docs/ops/production-deployment.md)
- [Dokploy runbook](docs/ops/dokploy-runbook.md)
- [Env matrix](docs/ops/dokploy-env.md)
- [Observability](docs/ops/observability.md)
- [Go-live](docs/ops/go-live.md)
