# Production Readiness

## Required checks

- CI passes on Node.js `22.12`.
- Prisma migrations deploy against a disposable PostgreSQL service.
- API Docker image builds and starts as non-root.
- Web Docker image builds and serves `/healthz`.
- API `/ready` reports database, Redis, and object storage as `up`.
- Swagger is disabled with `SWAGGER_ENABLED=false`.
- CORS is restricted to the production web origin.

## Infrastructure

- PostgreSQL is external, backed up, monitored, and not part of the app compose stack.
- Redis is included in production compose and is monitored for memory pressure.
- Object storage is AWS S3 for production unless a MinIO production runbook exists.
- Cloudflare DNS/proxy points to Dokploy Traefik; no Nginx tier is required.

## Security basics

- Clerk production keys are set.
- API uses Helmet and request IDs.
- API has global throttling.
- Secrets are stored in Dokploy/GitHub/Azure/AWS secret managers, not in Git.
- S3 public access is controlled through bucket policy or CDN, not object ACL sprawl.

## Release gate

Before routing traffic to a new release:

1. Run migrations once.
2. Deploy API/web images.
3. Wait for `/ready` and `/healthz`.
4. Smoke test Clerk login, survey CRUD, uploads, and exports.
5. Keep the previous image tag available for rollback.
