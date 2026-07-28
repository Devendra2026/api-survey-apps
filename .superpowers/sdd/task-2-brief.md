### Task 2: Framework and workspace dependency bumps

**Files:**

- Modify: `apps/web/package.json`, `apps/api/package.json`, `apps/worker/package.json`
- Modify: `packages/database/package.json`, `packages/ui/package.json`, other packages as needed
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Task 1 Node/turbo pins
- Produces: Latest compatible Next 16 / React 19 / Nest 11 / Prisma 7 / Clerk majors aligned across workspaces

- [ ] **Step 1: Bump web stack**

Run from repo root:

```bash
pnpm --filter web update next@latest react@latest react-dom@latest @clerk/nextjs@latest eslint-config-next@latest
pnpm --filter @workspace/ui update react@latest react-dom@latest
```

Expected: Next stays major 16; React stays major 19.

- [ ] **Step 2: Bump Nest apps**

```bash
pnpm --filter api update "@nestjs/*@latest" @clerk/backend@latest rxjs@latest class-validator@latest class-transformer@latest
pnpm --filter worker update "@nestjs/*@latest" rxjs@latest class-validator@latest class-transformer@latest
```

Expected: `@nestjs/core` remains major 11.

- [ ] **Step 3: Bump Prisma**

```bash
pnpm --filter @workspace/database update prisma@latest @prisma/client@latest
pnpm --filter @workspace/database db:generate
```

Expected: generate succeeds; no schema edits required. If Prisma prints a required config change, apply the minimal Prisma 7–compatible fix only in `packages/database/prisma.config.ts` / schema generator block.

- [ ] **Step 4: Build and typecheck**

```bash
pnpm turbo build
pnpm turbo typecheck
```

Expected: exit 0. Fix compile errors only (import paths, Clerk API renames, Nest DI typings). Do not refactor domain services.

- [ ] **Step 5: Lint and test**

```bash
pnpm turbo lint
pnpm turbo test
```

Expected: exit 0. Fix owned lint/test failures.

- [ ] **Step 6: Commit**

```bash
git add apps packages pnpm-lock.yaml
git commit -m "chore: bump Next Nest Prisma Clerk and workspace deps"
```

---
