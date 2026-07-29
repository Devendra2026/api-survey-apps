# Final review fix report

## Status

All requested Important findings were fixed on
`chore/production-upgrade-stability`.

## Commit

- `ff702a8 fix(ops): isolate backup runs and preflight restores`

## Changes

- Made `/` public through Clerk middleware while leaving `/api/maps-health`
  protected.
- Isolated aggregate backups in UTC per-run directories and wrote `.complete`
  atomically only after PostgreSQL, Redis, and MinIO all succeeded.
- Made aggregate restore select completed runs and preflight every required
  environment variable, tool, target, and artifact before PostgreSQL restore.
- Preserved standalone component backup behavior and mapped legacy
  `BACKUP_DIR` to `BACKUP_ROOT` in `scripts/ops/backup-pg.sh`.
- Updated backup/restore documentation and the production upgrade report.

## Verification

- `bash -n` on every changed Bash script: PASS.
- `bash scripts/backup-restore.test.sh`: PASS.
- `pnpm --filter web build`: PASS.
- IDE lint diagnostics for `apps/web/proxy.ts`: none.

## Concerns

- No live backup or destructive restore drill was run; the existing
  disposable-target restore drill remains a go-live requirement.
- Existing untracked `.superpowers/sdd` task artifacts were left untouched.
- Nothing was pushed.
