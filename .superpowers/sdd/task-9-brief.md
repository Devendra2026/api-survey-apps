### Task 9: Final validation gate

**Files:** none required (fix-forward only)

- [ ] **Step 1: Fresh install simulation**

```bash
pnpm install
pnpm turbo build
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Expected: all exit 0.

- [ ] **Step 2: Docker builds**

```bash
docker build -f apps/api/Dockerfile .
docker build -f apps/web/Dockerfile .
docker build -f apps/worker/Dockerfile .
docker compose -f docker-compose.dokploy.yml config
```

Expected: builds succeed; compose validates.

- [ ] **Step 3: Fix any failures inline, commit if needed**

```bash
git commit -m "fix: clear final validation failures from production upgrade"
```

- [ ] **Step 4: Update report with validation results**

Append CI/local command outcomes to the report file and commit.

---

## Spec coverage checklist

| Spec workstream                              | Task(s)     |
| -------------------------------------------- | ----------- |
| Turborepo / Node                             | 1, 9        |
| Next / Nest / Prisma / Clerk deps            | 2, 4        |
| Postgres / Redis / MinIO / Compose / Dokploy | 3, 7        |
| Docker optimization                          | 1 (pins), 3 |
| Backup / restore                             | 7           |
| Clerk + bootstrap + CLI                      | 4, 5, 6     |
| Dashboard 403                                | 5           |
| Cleanup / hardening / CI                     | 2, 3, 8, 9  |
| Deliverables (CHANGELOG, notes, report)      | 8           |

## Plan self-review

- No TBD placeholders; MinIO exact RELEASE resolved at Task 3 Step 1 from live registry.
- Dashboard policy matches design (403 + non-empty permissions).
- Promote CLI and backup paths match design file layout.
- Types: `hasDashboardAccess(permissions: string[] | null | undefined): boolean` used consistently in Tasks 5–6 narrative.
