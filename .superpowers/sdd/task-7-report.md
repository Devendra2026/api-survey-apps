# Task 7 Report: Backup and restore scripts

## Status

Implemented and committed as `5702f62` (`feat(ops): add postgres redis minio backup and restore scripts`).

## Changes

- Added executable PostgreSQL, Redis, and MinIO backup scripts that write UTC-dated artifacts under `${BACKUP_ROOT:-/backups}/YYYY-MM-DD/`.
- Added `scripts/backup/all.sh` orchestration plus printed `rsync` and `scp` off-host copy commands.
- Added guarded PostgreSQL, Redis, MinIO, and complete-set restore scripts; every restore requires `CONFIRM=yes`.
- Redis restore preserves existing RDB/AOF files and requires an explicitly selected stopped data volume.
- Converted the legacy PostgreSQL operations scripts into thin wrappers.
- Rewrote the operations guide with Dokploy commands, off-host copies, restore drills, AOF snapshot guidance, and production recovery sequencing.

## Verification

- Git Bash syntax checks (`bash -n`) passed for all backup, restore, and wrapper scripts.
- Required-variable behavior checks passed for PostgreSQL, Redis, and MinIO backups.
- Confirmation-guard checks passed for all four restore scripts.
- `git diff --cached --check` passed before commit.
- IDE diagnostics reported no linter errors.
- Pre-commit Prettier checks passed.

## Concerns

- ShellCheck is not installed in the current environment.
- No live PostgreSQL, Redis, or MinIO services were modified; operators should complete a disposable-target restore drill before relying on the scripts for production recovery.
- The MinIO restore overwrites matching objects but intentionally does not delete unrelated target objects.
- Existing untracked SDD artifacts were left untouched and were not included in the commit.
