# API Survey Apps

Turborepo monorepo with a Next.js web app, NestJS API, shared packages, Docker, and Dokploy-ready Compose.

## Stack

- **Apps:** `apps/web` (Next.js), `apps/api` (NestJS)
- **Packages:** `@workspace/ui`, `@workspace/database`, `@workspace/validation`, shared ESLint/TypeScript configs
- **Tooling:** pnpm workspaces, Turborepo, ESLint, Prettier, Husky, GitHub Actions

## Prerequisites

- Node.js 22.12+
- pnpm 10.33.4 (`corepack enable`)
- Docker Desktop (for Postgres / full Compose)

## Quick start (local)

```bash
# 1. Install
pnpm install

# 2. Env
cp .env.development.example .env.development
# keep real Clerk keys or local overrides in `.env.local`

# 3. Start local infrastructure (PostgreSQL, Redis, MinIO, Mailpit)
docker compose up -d

# 4. Migrate
pnpm db:migrate

# 5. Run API + Web + Worker
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:4000/health
- API ready (DB/Redis/Storage): http://localhost:4000/ready

## Environment

One file at the repo root drives everything:

| Consumer       | How it loads                                               |
| -------------- | ---------------------------------------------------------- |
| Nest API       | `ConfigModule` → `/.env.local`, `/.env.<NODE_ENV>`, `.env` |
| Worker         | `ConfigModule` → `/.env.local`, `/.env.<NODE_ENV>`, `.env` |
| Next.js        | `loadEnvConfig(monorepoRoot)` in `apps/web/next.config.ts` |
| Prisma         | `packages/database/load-root-env.ts`                       |
| Docker Compose | auto-reads root `/.env`                                    |

```bash
cp .env.development.example .env.development
```

Optional local overrides: `.env.local` (gitignored; wins over `.env`). Do not put secrets in `apps/*/.env*` anymore.

## Full Docker stack

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

## Scripts

| Command            | Description                            |
| ------------------ | -------------------------------------- |
| `pnpm dev`         | Start web + API + worker in watch mode |
| `pnpm build`       | Build all packages and apps            |
| `pnpm lint`        | Lint via Turbo                         |
| `pnpm typecheck`   | Typecheck via Turbo                    |
| `pnpm format`      | Format via Turbo                       |
| `pnpm db:generate` | Generate Prisma client                 |
| `pnpm db:migrate`  | Run Prisma migrate (dev)               |
| `pnpm db:deploy`   | Deploy migrations (prod)               |

## Dokploy + AWS production

Production: **Dokploy** runs web/api/worker + Docker Postgres, MinIO, and Redis.

Go-live steps: [`docs/ops/go-live.md`](docs/ops/go-live.md)

1. Fill `.env.production` (strong `POSTGRES_PASSWORD` + `MINIO_ROOT_PASSWORD`).
2. Deploy [`docker-compose.dokploy.yml`](docker-compose.dokploy.yml) in Dokploy (builds from Dockerfiles).
3. Map domains: `admin.sdvedutech.in` → web `:3001`, `backend.sdvedutech.in` → api `:4000` (worker `:4001`).
4. Open EC2 SG inbound TCP `3001`, `4000`, `4001` (and `80`/`443` for TLS proxy).

Local development remains Compose infra + `pnpm dev` (unchanged).

### Object storage (survey photos)

Use `STORAGE_PROVIDER=minio` in production and local. Objects stay on the MinIO Docker volume; the API issues presigned URLs. The optional `STORAGE_PROVIDER=s3` code path remains for CI/stubs only.

## Adding UI components

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Import from `@workspace/ui/components/...`.
