# Observability

Production apps expose Docker/Dokploy healthchecks and Prometheus metrics. A full Prometheus + Grafana + Loki stack is **optional** and is not part of [`docker-compose.dokploy.yml`](../../docker-compose.dokploy.yml) (keeps CPU/RAM free on a t3.xlarge).

## Built-in probes

| Service | Liveness       | Readiness    | Metrics        |
| ------- | -------------- | ------------ | -------------- |
| web     | `GET /healthz` | (same)       | —              |
| api     | `GET /live`    | `GET /ready` | `GET /metrics` |
| worker  | `GET /live`    | `GET /ready` | `GET /metrics` |

Compose healthchecks use liveness only. Use `/ready` for load-balancer readiness if you add external probes.

## Prometheus scrape (external)

Point any Prometheus at:

- `http://<api-host>:4000/metrics`
- `http://<worker-host>:4001/metrics`

Prefer scraping on the private Docker/Traefik network, not the public internet. Metrics endpoints are unauthenticated (`@Public` on api); firewall or Traefik middleware should restrict access.

## Optional overlay

```bash
# Ensure the Dokploy/compose app network name matches OBSERVABILITY_NETWORK
export GRAFANA_ADMIN_PASSWORD='strong-password'
docker compose -f docker-compose.observability.yml up -d
```

See [`docker-compose.observability.yml`](../../docker-compose.observability.yml) and [`deploy/observability/prometheus.yml`](../../deploy/observability/prometheus.yml).

Grafana UI: host port **3002**. Prometheus: **9090**. Loki: **3100**.

## Logging

Apps log to stdout/stderr. Use the Docker/Dokploy logging driver (or ship container logs to Loki via Promtail/Alloy on the host). Do not store application logs inside app container filesystems.

## Volumes and backups (AWS gp3)

Persistent data lives in named Docker volumes:

- `survey_pg_data_prod` — Postgres 17
- `survey_redis_data_prod` — Redis 8 AOF
- `survey_minio_data_prod` — object storage (uploads / exports)

Back up via Dokploy volume backups, `docker run --volumes-from` + `pg_dump`, or EC2/gp3 snapshots. Uploads and generated files belong in MinIO, not app containers.

### Postgres 16 → 17

Postgres major upgrades are **not** in-place on the same data directory. Before switching the compose image to `postgres:17-alpine`, dump the database, recreate/replace the volume, restore, or use `pg_upgrade` offline.
