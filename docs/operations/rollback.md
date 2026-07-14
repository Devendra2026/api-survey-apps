# Rollback

## Application rollback

Production compose files include Swarm-style update policy with `order: start-first` and `failure_action: rollback`. Dokploy can redeploy a previous image tag by setting:

- `API_IMAGE`
- `WEB_IMAGE`
- `WORKER_IMAGE` when a worker exists

Validate after rollback:

```bash
curl -fsS https://api.example.com/ready
curl -fsS https://app.example.com/healthz
```

## Database rollback

Prisma migrations are forward-only operationally. Prefer a forward fix migration over reverting schema state.

If data corruption or a destructive migration requires restore:

1. Stop application writes.
2. Take a final backup.
3. Restore the last known-good dump into staging.
4. Verify app health and data.
5. Restore production using `scripts/ops/restore-pg.sh`.

## Expand-contract safety

Use expand-contract migrations to make app rollback possible. A rollback is much safer when the previous app version can still run against the expanded schema.
