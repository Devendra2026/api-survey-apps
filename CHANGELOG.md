# Changelog

## [Unreleased]

### Changed

- Updated the production toolchain to Node 24, pnpm 11.17.0, Turbo 2.10.7,
  TypeScript 5.9.3, ESLint 9.39.5, and Prettier 3.9.6.
- Updated Prisma to 7.9.1, Clerk Next.js to 7.6.1, Clerk backend to 3.13.1,
  and NestJS Swagger to 11.4.6 while retaining Next.js 16.2.6, React 19.2.4,
  and NestJS core 11.1.28.
- Refreshed deployable MinIO image pins and aligned authenticated Redis
  configuration across production Compose and Swarm.
- Hardened Dokploy Compose with fail-closed secrets, private application
  ports, Traefik-only ingress, and the existing migration startup gate.

### Security

- Protected all non-public web routes in Clerk middleware.
- Changed dashboard authorization to return HTTP 403 for authenticated users
  without permissions and removed the Pending User soft-gate.

### Added

- Added an idempotent admin-promotion CLI:
  `pnpm admin:promote -- --clerk-user-id user_xxxxx`.
- Added guarded PostgreSQL, Redis, and MinIO backup/restore scripts under
  `scripts/backup` and `scripts/restore`, including complete-set orchestration
  and off-host copy guidance.
- Added production migration notes and an operator environment matrix for
  Clerk bootstrap, web build arguments, infrastructure secrets, and
  `BACKUP_ROOT`.
