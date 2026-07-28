# Production upgrade migration notes — 2026-07-29

These notes cover commits `ab1fd00` through `5702f62` on
`chore/production-upgrade-stability`.

## Released versions

- Node 24; pnpm 11.17.0; Turbo 2.10.7.
- TypeScript 5.9.3; ESLint 9.39.5; Prettier 3.9.6.
- Next.js 16.2.6; React 19.2.4; NestJS core 11.1.28.
- Prisma CLI, Client, and PostgreSQL adapter 7.9.1.
- Clerk Next.js 7.6.1 and Clerk backend 3.13.1.
- PostgreSQL 17 Alpine; Redis 8 Alpine.
- MinIO server `RELEASE.2025-09-07T16-13-09Z` and client
  `RELEASE.2025-08-13T08-35-41Z`.

## Before deployment

1. Back up PostgreSQL, Redis, and MinIO and copy the dated set off-host:

   ```bash
   BACKUP_ROOT=/backups \
   DATABASE_URL='postgresql://...' \
   REDIS_URL='redis://:password@redis:6379' \
   MINIO_ENDPOINT='http://minio:9000' \
   MINIO_ROOT_USER='...' \
   MINIO_ROOT_PASSWORD='...' \
   MINIO_BUCKET='api-survey-app' \
     bash scripts/backup/all.sh
   ```

   Confirm all three artifacts exist. Complete a disposable-target restore
   drill before relying on them for recovery.

2. Treat a PostgreSQL major-version change as a data migration, not an image
   replacement. A data directory initialized by another PostgreSQL major is
   not guaranteed to start under PostgreSQL 17. Use `pg_dump`/`pg_restore` (or
   a planned `pg_upgrade`) into a fresh volume. Never attach an old-major
   volume directly to the PostgreSQL 17 container.

3. Populate all required values from
   `deploy/env/dokploy.compose.env.example`. In particular:
   - use strong, matching PostgreSQL, Redis, and MinIO credentials;
   - set Clerk secret/publishable keys and `CLERK_AUTHORIZED_PARTIES`;
   - set `BOOTSTRAP_ADMIN_CLERK_USER_IDS` before first production sign-in;
   - set `BACKUP_ROOT` to a restricted host path.

4. Rebuild the web image whenever `NEXT_PUBLIC_API_URL`,
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, or
   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` changes. These values are build-time
   inputs and a runtime-only restart retains the old values.

## Deploy and verify

1. Deploy `docker-compose.dokploy.yml`; do not expose application ports
   directly. Only Traefik ports 80/443 should be public.
2. Verify PostgreSQL, Redis, and MinIO health, then migration completion,
   API `/health` and `/ready`, and web sign-in.
3. Confirm an unauthorized dashboard profile receives HTTP 403 and the
   configured bootstrap admin receives dashboard permissions.
4. If bootstrap configuration was missed or an existing user needs promotion,
   use the supported CLI instead of editing role tables:

   ```bash
   pnpm admin:promote -- --clerk-user-id user_xxxxx
   ```

5. Run `bash scripts/backup/all.sh` once against the deployed services, copy
   the resulting directory off-host, and schedule recurring backups.

No Prisma schema change was introduced by this upgrade. Prisma Client must
still be regenerated during build, and the existing migration gate remains
required before API and worker startup.
