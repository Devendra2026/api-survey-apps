# Task 3 Report: Docker Compose and Dokploy hardening

## Status

Complete. The Dokploy production stack keeps the required eight services (`postgres`, `redis`, `minio`, `minio-init`, `migrate`, `api`, `worker`, and `web`), uses Traefik as the only application ingress, preserves the migration gate, refreshes deployable MinIO image pins, and aligns Swarm Redis authentication.

## Changes

- Updated the MinIO server image to `minio/minio:RELEASE.2025-09-07T16-13-09Z`.
- Updated the MinIO client image to `minio/mc:RELEASE.2025-08-13T08-35-41Z`.
- Applied the same MinIO pins to Dokploy Compose, local Compose, and the secondary Swarm stack.
- Removed host `ports` mappings from Dokploy `api`, `worker`, and `web`.
- Kept `api` and `web` attached to `dokploy-network` with Traefik labels; kept `worker` internal.
- Updated deployment and go-live documentation to state that only Traefik ports `80`/`443` should be publicly exposed.
- Preserved the private Dokploy bucket initialization; no anonymous-download policy was added.
- Aligned the secondary Swarm Redis service with production authentication by requiring `REDIS_PASSWORD`, adding `--requirepass`, authenticating its health check, and updating API/worker Redis URLs.
- Made no application business-logic changes.

## Migration gate confirmation

- `migrate` still builds from `apps/api/Dockerfile`.
- `migrate` still runs `/app/apps/api/docker-entrypoint.migrate.sh`.
- Both `api` and `worker` still depend on `migrate` with `condition: service_completed_successfully`.

## Validation

- `docker manifest inspect minio/minio:RELEASE.2025-09-07T16-13-09Z` — passed.
- `docker manifest inspect minio/mc:RELEASE.2025-08-13T08-35-41Z` — passed.
- `docker compose -f docker-compose.dokploy.yml config --quiet` with validation-only secrets — passed.
- `docker compose -f docker-compose.dokploy.yml config --services` — returned exactly the eight required services.
- `docker compose -f docker-compose.yml config --quiet` — passed.
- `docker compose -f deploy/docker-stack.swarm.yml config --quiet` with validation-only secrets and example env files — passed.
- Dokploy Compose with required secrets unset — failed closed as expected on `POSTGRES_PASSWORD`.
- `git diff --check` — passed.

## Concern and release-pin rationale

The newest MinIO source release is `RELEASE.2025-10-15T17-29-55Z`, but MinIO's release notes require container users to build it themselves and Docker Hub has no manifest for that tag. The selected `RELEASE.2025-09-07T16-13-09Z` is therefore the newest official `minio/minio` release tag verified as directly deployable from Docker Hub. The latest published `minio/mc` image is `RELEASE.2025-08-13T08-35-41Z`; both images are from the same current release era and have multi-architecture manifests.

## Files changed

- `docker-compose.dokploy.yml`
- `docker-compose.yml`
- `deploy/docker-stack.swarm.yml`
- `DEPLOYMENT.md`
- `docs/ops/dokploy-compose-setup.md`
- `docs/ops/go-live.md`
- `.superpowers/sdd/task-3-report.md`
