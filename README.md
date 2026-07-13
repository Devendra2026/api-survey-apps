# API Survey Apps

Turborepo monorepo with a Next.js web app, NestJS API, shared packages, Docker, and Dokploy-ready Compose.

## Stack

- **Apps:** `apps/web` (Next.js), `apps/api` (NestJS)
- **Packages:** `@workspace/ui`, `@workspace/database`, `@workspace/validation`, shared ESLint/TypeScript configs
- **Tooling:** pnpm workspaces, Turborepo, ESLint, Prettier, Husky, GitHub Actions

## Prerequisites

- Node.js 20+
- pnpm 10.33.4 (`corepack enable`)
- Docker Desktop (for Postgres / full Compose)

## Quick start (local)

```bash
# 1. Install
pnpm install

# 2. Env files
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/database/.env.example packages/database/.env

# 3. Start Postgres only
docker compose -f docker-compose.dev.yml up -d

# 4. Migrate
pnpm db:migrate

# 5. Run apps
pnpm dev
```

- Web: http://localhost:3000
- API health: http://localhost:4000/health
- API ready (DB): http://localhost:4000/health/ready

## Full Docker stack

```bash
cp .env.example .env
docker compose up --build
```

## Scripts

| Command            | Description                   |
| ------------------ | ----------------------------- |
| `pnpm dev`         | Start web + API in watch mode |
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
   - `POSTGRES_PASSWORD`
   - `DATABASE_URL` (or rely on the compose default using the postgres service)
   - `CORS_ORIGIN` (your web domain)
   - `NEXT_PUBLIC_API_URL` (public API URL used by the browser)
4. Map domains:
   - Web → service `web`, port `3000`
   - API → service `api`, port `4000`
5. Deploy. The API entrypoint runs `prisma migrate deploy` on start.

## Adding UI components

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Import from `@workspace/ui/components/...`.
