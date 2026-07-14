# Environment

## Precedence

Real process environment values win over files. The API, worker, Prisma scripts, and web load repo-root `.env.local` first, then `.env.<NODE_ENV>`, then `.env`. Docker Compose interpolates from the shell and repo-root `.env`. Example files are templates only.

Use:

- `.env.example` as the full catalog.
- `.env.development.example` as local defaults. Copy it to ignored `.env.development` for host-run `pnpm dev`.
- `.env.production.example` as a production secret manager checklist.

Do not commit `.env`, `.env.local`, `.env.development`, or `.env.production`.

## Required production values

- `DATABASE_URL` and usually `DIRECT_URL`
- `REDIS_URL`
- `APP_URL`, `API_URL`, `NEXT_PUBLIC_API_URL`, `CORS_ORIGIN`
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `STORAGE_PROVIDER`

The API fails fast when production Clerk values are missing, Redis is missing, or storage-specific values are incomplete.

## Storage

For local MinIO:

- `STORAGE_PROVIDER=minio`
- `MINIO_ENDPOINT`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `MINIO_BUCKET`

For AWS S3:

- `STORAGE_PROVIDER=s3`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- optional `AWS_S3_PUBLIC_URL` for CloudFront/CDN URLs

## Upload limits

Set `UPLOAD_MAX_FILE_SIZE_BYTES` as the preferred application limit. `STORAGE_MAX_FILE_SIZE_BYTES` and `AWS_S3_MAX_FILE_SIZE_BYTES` are fallback compatibility values.

## Redis

`REDIS_URL` is required by both API and worker because BullMQ queues are always registered.

- Host-run local development: `redis://localhost:6379`
- Docker Compose / Dokploy service-to-service traffic: `redis://redis:6379`

If Redis is missing or `REDIS_URL` is absent, startup fails with an actionable message instead of falling back to `127.0.0.1`.
