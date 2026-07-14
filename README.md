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

| Command            | Description                   |
| ------------------ | ----------------------------- |
| `pnpm dev`         | Start web + API + worker in watch mode |
| `pnpm build`       | Build all packages and apps   |
| `pnpm lint`        | Lint via Turbo                |
| `pnpm typecheck`   | Typecheck via Turbo           |
| `pnpm format`      | Format via Turbo              |
| `pnpm db:generate` | Generate Prisma client        |
| `pnpm db:migrate`  | Run Prisma migrate (dev)      |
| `pnpm db:deploy`   | Deploy migrations (prod)      |

## Dokploy

1. Create a **Docker Compose** application in Dokploy.
2. Point it at [`docker-compose.dokploy.yml`](docker-compose.dokploy.yml).
3. Set environment variables / secrets:
   - `DATABASE_URL` / `DIRECT_URL` (external PostgreSQL)
   - `REDIS_URL` is provided internally as `redis://redis:6379` by the Dokploy compose stack
   - `CORS_ORIGIN` (your web domain)
   - `NEXT_PUBLIC_API_URL` (public API URL used by the browser)
   - `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` if not using an instance/profile credential provider
   - `AWS_REGION` (default `ap-south-1`)
   - `AWS_S3_BUCKET` (default `api-survey-app`)
   - `AWS_S3_PUBLIC_URL` (optional CloudFront / CDN base URL)
   - `AWS_S3_MAX_FILE_SIZE_BYTES` (optional; default `5242880`)
4. Map domains:
   - Web → service `web`, port `3000`
   - API → service `api`, port `4000`
5. Deploy. Run migrations as a one-shot release step before rolling API/web/worker.

## AWS S3 (survey photos)

Photo uploads go to S3 bucket `api-survey-app` in `ap-south-1`. Full setup (CloudFormation or console, IAM, env vars): [`docs/aws-s3-setup.md`](docs/aws-s3-setup.md).

## Adding UI components

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Import from `@workspace/ui/components/...`.
