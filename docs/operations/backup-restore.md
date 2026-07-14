# Backup And Restore

## PostgreSQL backups

Use `scripts/ops/backup-pg.sh` from Git Bash or WSL on Windows:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public" ./scripts/ops/backup-pg.sh
```

The script writes a compressed custom-format dump into `./backups` unless `BACKUP_DIR` is set.

## PostgreSQL restore

Restore is destructive because it uses `pg_restore --clean --if-exists`:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public" ./scripts/ops/restore-pg.sh ./backups/api-survey-YYYYMMDDTHHMMSSZ.dump.gz
```

Restore into staging first, run migrations, and verify `/ready` before restoring production.

## Object storage

Production should use S3 with bucket versioning and lifecycle policies. MinIO is intended for local development unless explicitly operated as a production object store.

For S3, enable:

- versioning
- default encryption
- blocked public ACLs
- lifecycle rules for old object versions

## Redis

Redis in production compose uses append-only persistence for operational resilience, but it should not be treated as the system of record. PostgreSQL and object storage are the durable backup targets.
