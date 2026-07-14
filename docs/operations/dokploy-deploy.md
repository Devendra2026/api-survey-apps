# Dokploy Deployment

## Topology

Use `docker-compose.dokploy.yml` with GHCR images for API, web, and the future worker, plus Redis. PostgreSQL and object storage are external services. Do not run Postgres or MinIO inside the production app compose file.

Cloudflare should point DNS to the Dokploy/Traefik host. Traefik terminates traffic for the app and API services, so no Nginx layer is required.

## Required Dokploy secrets

- `DATABASE_URL`
- `DIRECT_URL` when the provider has transaction pooling
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_API_URL`
- `CORS_ORIGIN`
- S3 variables from `environment.md`
- optional `DOKPLOY_WEBHOOK_URL` in GitHub Actions for release triggers

## Images

The compose file uses placeholders:

- `API_IMAGE=ghcr.io/OWNER/api-survey-apps-api:latest`
- `WEB_IMAGE=ghcr.io/OWNER/api-survey-apps-web:latest`
- `WORKER_IMAGE=ghcr.io/OWNER/api-survey-apps-worker:latest`

Replace `OWNER` with the actual GHCR namespace or set these variables in Dokploy.

## Migrations

Run migrations once before scaling new API replicas:

```bash
docker run --rm --env-file .env.production ghcr.io/OWNER/api-survey-apps-api:latest sh /app/apps/api/docker-entrypoint.migrate.sh
```

The normal API entrypoint does not run migrations. This prevents every replica from attempting schema changes at startup.

## Health

- API readiness: `/ready`
- API liveness: `/live`
- Web health: `/healthz`

Dokploy/Traefik should route public domains to API port `4000` and web port `3000`.
