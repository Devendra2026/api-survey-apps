# Local Setup

## Prerequisites

- Node.js `>=22.12`
- pnpm `10.33.4` via Corepack
- Docker Desktop with Compose v2
- PostgreSQL client tools if you use `scripts/ops/*.sh`

## Environment

Copy `.env.development.example` to `.env.development` for non-secret local defaults, then keep real secrets in `.env.local`, which remains ignored.

For host-run app development, start only infrastructure with the default compose file, then run Turbo on the host:

```bash
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

This starts PostgreSQL, Redis, MinIO on `9000/9001`, and Mailpit. The API, web, and worker run through `pnpm dev` and use `REDIS_URL=redis://localhost:6379` from `.env.development`.

For a Docker-first full stack:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Containerized API/worker use `REDIS_URL=redis://redis:6379` because they reach Redis over the Compose network.

## Local URLs

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`
- API readiness: `http://localhost:4000/ready`
- Swagger in development: `http://localhost:4000/docs`
- MinIO console: `http://localhost:9001`
- Mailpit: `http://localhost:8025`

## Migrations

Local development can use:

```bash
pnpm db:migrate
```

Production deployments should use `pnpm db:deploy` or the API image migration entrypoint documented in `migrations.md`.
