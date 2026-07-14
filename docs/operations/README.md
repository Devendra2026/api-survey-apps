# Operations

Start here:

- `local-setup.md`
- `environment.md`
- `dokploy-deploy.md`
- `migrations.md`
- `backup-restore.md`
- `rollback.md`
- `production-readiness.md`

The production model is Cloudflare DNS/proxy to Dokploy Traefik, with external PostgreSQL and S3-compatible object storage. Redis is the only stateful service included in production compose.
