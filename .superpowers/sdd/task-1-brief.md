### Task 1: Toolchain inventory and Turborepo bump

**Files:**

- Modify: `package.json`
- Modify: `turbo.json`
- Modify: `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/worker/Dockerfile` (ARG pins only in this task if versions change)
- Modify: `.github/workflows/ci.yml` (only if Node/pnpm pin differs)

**Interfaces:**

- Produces: root `turbo` at latest 2.x; `turbo.json` with `!.next/dev/**` in build outputs; Docker ARG strings matching root pins

- [ ] **Step 1: Record current versions**

Run:

```bash
node -v
pnpm -v
pnpm why turbo
pnpm list turbo next @nestjs/core prisma react --depth 0 -r
```

Expected: Node v24.x, pnpm 11.x, versions matching design baseline.

- [ ] **Step 2: Bump root turbo / typescript / eslint / prettier within majors**

In root `package.json`, set (resolve exact latest with `pnpm view <pkg> version` at implement time):

```json
"devDependencies": {
  "turbo": "^2.10.5",
  "typescript": "^5.9.2",
  "eslint": "^9.39.4",
  "prettier": "^3.9.5"
}
```

Run:

```bash
pnpm add -Dw turbo@latest typescript@latest eslint@latest prettier@latest
```

Expected: lockfile updates; no workspace protocol breakage.

- [ ] **Step 3: Update `turbo.json` build outputs**

Replace build `outputs` with:

```json
"outputs": [".next/**", "!.next/cache/**", "!.next/dev/**", "dist/**"]
```

Keep existing `tasks`, `dependsOn`, `globalEnv`, and `db:generate` outputs. Do not rename `tasks` → `pipeline`.

- [ ] **Step 4: Align Dockerfile ARG defaults**

In each of `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/worker/Dockerfile`, set:

```dockerfile
ARG NODE_VERSION=24
ARG PNPM_VERSION=11.17.0
ARG TURBO_VERSION=2.10.5
```

Update `PNPM_VERSION` / `TURBO_VERSION` to the versions just installed (read from `package.json` `packageManager` and `devDependencies.turbo`).

- [ ] **Step 5: Smoke turbo**

Run:

```bash
pnpm turbo run build --dry-run=json
pnpm exec turbo --version
```

Expected: dry-run lists tasks; no schema warnings about deprecated `pipeline`.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml turbo.json apps/api/Dockerfile apps/web/Dockerfile apps/worker/Dockerfile
git commit -m "chore: bump turbo toolchain and refresh turbo.json outputs"
```

---
