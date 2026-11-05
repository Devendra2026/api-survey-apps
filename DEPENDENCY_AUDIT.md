# Dependency Audit

Date: 2026-11-06 · Package manager: pnpm 12.5.1 (`packageManager` pin), lockfile v9, CI installs with `--frozen-lockfile`.

## Inventory

| Workspace     | Key runtime deps                                                                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`    | NestJS 11, `@clerk/backend` 3, Prisma 7 (via `@workspace/database`), BullMQ 5 + ioredis 5, AWS SDK v3 (S3/MinIO), multer 2.2, exceljs, pdfkit, helmet, pino-http, prom-client |
| `apps/worker` | NestJS 11, BullMQ, ioredis, AWS SDK v3, exceljs, pdfkit, archiver, playwright 1.51                                                                                            |
| `apps/web`    | Next 16.2.6, React 19.2.4, `@clerk/nextjs` 7, TanStack Query/Table/Virtual, axios, zod 4, zustand, xlsx 0.18.5, recharts                                                      |
| `apps/mobile` | Expo SDK 57, React Native 0.86, React 19.2.3, `@clerk/expo`, TanStack Query                                                                                                   |
| `packages/*`  | `database` (Prisma 7 + pg adapter), `validation` (zod), `etl-core`, `audit-etl`, `excel-reports`, `jobs` (types), `ui` (shadcn/radix), eslint/ts configs                      |

## `pnpm audit --prod` (2026-11-06)

167 advisories: 7 critical, 75 high, 72 moderate, 13 low. Most are transitive build/CLI tooling. The ones that reach production runtime:

| Severity       | Package (installed)    | Patched                                              | Where                 | Runtime exposure                                                                                                |
| -------------- | ---------------------- | ---------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Critical**   | `next` 16.2.6          | ≥ 16.4.1 (covers 16.3.3/16.3.6/16.3.8/16.2.11 fixes) | web                   | Public web server. Unauthenticated RCE in Image Optimizer and `next/og`, SSRF in Image Optimizer, proxy bypass. |
| Critical       | `proxy-addr` < 2.0.8   | ≥ 2.0.8                                              | api, worker (express) | IP spoofing via IPv4-mapped IPv6 → per-IP throttle bucket.                                                      |
| High           | `multer` 2.2.0         | ≥ 2.5.0                                              | api                   | Multipart DoS + fd leak on photo/import upload routes.                                                          |
| High           | `compression` < 1.8.2  | ≥ 1.8.2                                              | api                   | Memory-leak DoS.                                                                                                |
| High           | `body-parser` < 2.4.0  | ≥ 2.4.0                                              | api, worker           | DoS via trailing bytes.                                                                                         |
| High           | `axios` < 1.20.0       | ≥ 1.20.0                                             | web (browser)         | Prototype-pollution gadgets / ReDoS.                                                                            |
| High           | `xlsx` 0.18.5          | none on npm                                          | web                   | Parser vulnerable. **Parse path removed in this audit**; write-only use remains.                                |
| High           | `playwright` 1.51.0    | ≥ 1.55.1                                             | worker                | Browser download without integrity check (image build time).                                                    |
| High           | `sharp` < 0.35.5       | ≥ 0.35.5                                             | web (Next image)      | libvips/libheif/librsvg CVEs. Pulled by `next`.                                                                 |
| Critical (dev) | `shell-quote` < 1.11.0 | ≥ 1.11.0                                             | mobile (Expo CLI)     | Dev tooling only.                                                                                               |

## Unused / misplaced dependencies

| Package                                         | Workspace     | Evidence                                                                                                | Status                                                                                                                                                                   |
| ----------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@aws-sdk/client-s3`                            | `apps/web`    | No import anywhere in `apps/web` (grep for `aws-sdk`/`client-s3`, incl. dynamic). Adds ~MBs to install. | **Not removed** — `pnpm remove` re-resolved the whole lockfile (≈18k changed lines). Reverted to keep the lockfile stable; remove together with the upgrade batch below. |
| `@clerk/react`, `react-dom`, `react-native-web` | `apps/mobile` | Needed for Expo web target; keep.                                                                       | Keep                                                                                                                                                                     |
| `.claude-flow/`, `.swarm/` (tracked files)      | repo root     | Local agent-tooling state, rewritten in the background, ~58k lines of churn.                            | Recommend `git rm --cached` + `.gitignore`. Not changed (not code).                                                                                                      |
| `tmp-clerk-fingerprint.mjs`                     | repo root     | One-off diagnostic script.                                                                              | Recommend delete. Not changed.                                                                                                                                           |

## Version consistency

- React: web/ui on 19.2.4, mobile on 19.2.3 (Expo pin) — acceptable, separate bundles.
- TypeScript: root/api/worker 5.9, mobile `~6.0.3`. Mobile typechecks clean; keep mobile on Expo's recommended version.
- `@types/node`: 26 (api/worker/packages) vs 20 (web, database, ui) vs 22 (mobile). Runtime is Node ≥ 24 (`engines`). Low risk; align to 24 when convenient.
- Prisma 7.9 used consistently via `@workspace/database`.

## Changes made (branch `chore/security-dependency-upgrades`, approved upgrade batch)

| Package                                    | Before        | After                          | How                                                                                                                                                               |
| ------------------------------------------ | ------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`, `@next/env` (web)                  | 16.2.6        | 16.4.5 (exact, same pin style) | manifest                                                                                                                                                          |
| `@next/eslint-plugin-next` (eslint-config) | ^16.2.6       | ^16.4.5                        | manifest, kept in step with `next`                                                                                                                                |
| `axios` (web)                              | 1.18.1        | 1.21.0                         | manifest                                                                                                                                                          |
| `@aws-sdk/client-s3` (web)                 | 3.1085.0      | removed                        | unused; api/worker still use it                                                                                                                                   |
| `multer`                                   | 2.2.0         | 2.5.0                          | manifest **and** `pnpm-workspace.yaml` override — `@nestjs/platform-express` (even 11.2.8) pins 2.4.0, and that copy is the one `FileInterceptor` uses at runtime |
| `compression`                              | 1.8.1         | 1.8.2                          | manifest + override (old copy came via Expo CLI)                                                                                                                  |
| `playwright` (worker)                      | 1.51.0        | 1.55.1 (exact)                 | manifest. Dockerfile installs the browser with the package's own CLI, so the browser follows automatically                                                        |
| `proxy-addr`, `body-parser`                | 2.0.7 / 2.3.0 | 2.0.8 / 2.4.0                  | `pnpm update -r` within existing ranges                                                                                                                           |
| `sharp`, `postcss`, `qs`, `content-type`   | —             | patched                        | pulled transitively by the above                                                                                                                                  |

**Lockfile review**: 47 package versions changed, 2 platform packages added (sharp wasm variants), 2 removed (`concat-stream`, `typedarray`, dropped by multer 2.5), **no new major versions**. The ~18k-line textual diff is pnpm 12 rewriting quote style (`"@scope/x"` → `'@scope/x'`), not version churn. Lockfile v9 kept; `--frozen-lockfile` installs succeed.

**After**: `pnpm audit --prod` 167 → 119 advisories; critical 7 → 1.

## Still open (next batch)

| Severity      | Package                                                                    | Where                                          | Note                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| High          | `zod` < 4.6.6                                                              | validation, web, mobile, etl                   | Runtime (request validation). `^4.4.3` range already allows 4.6.6: `pnpm update zod -r`.                                                |
| High          | `follow-redirects`                                                         | web (via axios)                                | Server-side axios only. Refresh with `pnpm update follow-redirects -r`.                                                                 |
| High          | `xlsx`                                                                     | web                                            | No patched npm release; write-only use remains. Replace with `exceljs` or vendor build.                                                 |
| Critical/High | `shell-quote`, `node-forge`, `js-yaml`, `decode-uri-component`             | mobile                                         | Expo CLI / build tooling, not shipped in the app bundle. Follow Expo SDK patch releases (`expo install --fix`).                         |
| High          | `undici`, `systeminformation`, `@modelcontextprotocol/sdk`, `browserslist` | ui (via `shadcn` CLI devtool)                  | `shadcn` is listed under `dependencies` of `packages/ui`; it is a CLI. Moving it to `devDependencies` takes these out of the prod tree. |
| High          | `mysql2`, `deepmerge-ts`, `fast-uri`                                       | database (via `prisma` CLI / dev server)       | Prisma CLI internals; not used at runtime (pg adapter).                                                                                 |
| High          | `brace-expansion`                                                          | api/worker (via build tooling: Nest CLI, glob) | Build-time only.                                                                                                                        |
