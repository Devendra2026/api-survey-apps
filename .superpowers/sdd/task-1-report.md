# Task 1 Report: Toolchain inventory and Turborepo bump

**Branch:** `chore/production-upgrade-stability`  
**Status:** DONE  
**Commit:** `ab1fd00` — chore: bump turbo toolchain and refresh turbo.json outputs

## Step 1: Baseline inventory

| Tool              | Version                          |
| ----------------- | -------------------------------- |
| Node              | v24.14.1                         |
| pnpm              | 11.17.0                          |
| turbo (root)      | 2.10.5 → **2.10.7** (after bump) |
| typescript (root) | ^5.9.2 → **5.9.3**               |
| eslint (root)     | ^9.39.4 → **9.39.5**             |
| prettier (root)   | ^3.9.5 → **3.9.6**               |

**Workspace app versions (unchanged — Task 2 scope):**

| Package                      | Version |
| ---------------------------- | ------- |
| next (web)                   | 16.2.6  |
| react (web/ui)               | 19.2.4  |
| @nestjs/core (api/worker)    | 11.1.28 |
| prisma (@workspace/database) | 7.8.0   |

## Step 2: Root devDependency bumps

Updated root `package.json` devDependencies (within majors):

```json
{
  "turbo": "^2.10.7",
  "typescript": "^5.9.3",
  "eslint": "^9.39.5",
  "prettier": "^3.9.6"
}
```

**Note:** Initial `pnpm add -Dw turbo@latest typescript@latest eslint@latest prettier@latest` pulled TypeScript 7.0.2 and ESLint 10.8.0 (major bumps). Per brief "within majors", re-ran with `pnpm add -Dw turbo@2 typescript@5 eslint@9 prettier@3` to stay on current major lines.

Lockfile updated; no workspace protocol breakage observed.

## Step 3: turbo.json build outputs

Updated `build` task outputs:

```json
"outputs": [".next/**", "!.next/cache/**", "!.next/dev/**", "dist/**"]
```

Preserved: `tasks` key (not renamed to `pipeline`), all other task configs, `globalEnv`, `db:generate` outputs.

## Step 4: Dockerfile ARG alignment

All three Dockerfiles updated:

```dockerfile
ARG NODE_VERSION=24
ARG PNPM_VERSION=11.17.0
ARG TURBO_VERSION=2.10.7
```

Files: `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/worker/Dockerfile`.

## Step 5: CI workflow

`.github/workflows/ci.yml` reviewed — already pins `node-version: "24"` and uses `pnpm/action-setup@v4` with version from `packageManager` (11.17.0). **No change required.**

## Step 6: Smoke verification

```bash
pnpm exec turbo --version   # 2.10.7
pnpm turbo run build --dry-run=json
```

- turbo version: **2.10.7**
- Dry-run: **22 tasks** listed across 12 packages
- No deprecated `pipeline` schema warnings
- No turbo schema deprecation warnings

## Files changed

| File                     | Change                                  |
| ------------------------ | --------------------------------------- |
| `package.json`           | Bumped turbo/typescript/eslint/prettier |
| `pnpm-lock.yaml`         | Lockfile refresh                        |
| `turbo.json`             | Added `!.next/dev/**` to build outputs  |
| `apps/api/Dockerfile`    | TURBO_VERSION 2.10.5 → 2.10.7           |
| `apps/web/Dockerfile`    | TURBO_VERSION 2.10.5 → 2.10.7           |
| `apps/worker/Dockerfile` | TURBO_VERSION 2.10.5 → 2.10.7           |

## Self-review

### Correctness

- All brief steps completed.
- Scope respected: no Next/Nest/Prisma bumps.
- Docker ARG pins match root `packageManager` and resolved turbo version.

### Concerns (minor)

1. **`pnpm add @latest` vs within majors:** The brief's Step 2 command uses `@latest` but the step title says "within majors" and the JSON specifies major-compatible floors. Resolved by using `@2/@5/@9/@3` tags instead of bare `@latest` to avoid TS 7 / ESLint 10.
2. **Per-package toolchain drift:** Some workspace packages still declare older typescript/prettier in their own `package.json` (e.g. api has typescript@5.9.2, prettier@3.9.5). Root bump does not force workspace alignment — acceptable for Task 1 scope; consider harmonizing in a later task if desired.

### Not done (out of scope)

- Next.js / NestJS / Prisma version bumps (Task 2)
- Full `pnpm build` execution (dry-run only per brief)
- Push to remote (explicitly deferred)

## Verification checklist

- [x] Node v24.x confirmed
- [x] pnpm 11.x confirmed
- [x] Root turbo/typescript/eslint/prettier bumped within majors
- [x] turbo.json outputs include `!.next/dev/**`
- [x] Dockerfile ARG pins aligned
- [x] Smoke turbo dry-run passes
- [x] Committed (not pushed)
