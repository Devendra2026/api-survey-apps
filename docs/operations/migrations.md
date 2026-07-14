# Migrations

## Local development

Use Prisma migrate dev locally:

```bash
pnpm db:migrate
```

Regenerate the client after schema changes:

```bash
pnpm db:generate
```

## Production

Use migrate deploy exactly once per release:

```bash
pnpm db:deploy
```

For containerized production, use the API image migration entrypoint:

```bash
docker run --rm --env-file .env.production ghcr.io/OWNER/api-survey-apps-api:TAG sh /app/apps/api/docker-entrypoint.migrate.sh
```

## Expand-contract rule

Use expand-contract migrations for breaking changes:

1. Expand: add nullable columns, new tables, new indexes, or dual-write paths.
2. Deploy app code that can read old and new shapes.
3. Backfill data with a controlled script/job.
4. Contract: remove old columns or constraints only after the new code is live and verified.

Avoid destructive migrations in the same release as app code that first depends on the new schema.

## CI

CI runs `pnpm db:deploy` against a disposable PostgreSQL service to validate migrations before Docker builds.
