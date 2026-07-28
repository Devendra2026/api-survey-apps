### Task 8: Env docs, migration notes, CHANGELOG, report

**Files:**

- Modify: `.env.example`, `deploy/env/dokploy.compose.env.example`, `docs/ops/dokploy-env.md`
- Create: `docs/superpowers/migrations/2026-07-29-production-upgrade-notes.md`
- Create or modify: `CHANGELOG.md`
- Create: `docs/superpowers/reports/2026-07-29-production-upgrade-report.md`

**Interfaces:**

- Consumes: all prior tasks’ actual versions and fixes
- Produces: operator-ready docs + issue/fix report

- [ ] **Step 1: Env matrix**

Ensure documented:

- `BOOTSTRAP_ADMIN_CLERK_USER_IDS`
- Clerk publishable/secret + `NEXT_PUBLIC_*` build args
- `CLERK_AUTHORIZED_PARTIES`
- DB/Redis/MinIO secrets
- `BACKUP_ROOT`

- [ ] **Step 2: Migration notes**

Include: PG volume major warning, rebuild web for `NEXT_PUBLIC_*`, set bootstrap IDs before go-live, run `scripts/backup/all.sh` smoke, promote CLI usage.

- [ ] **Step 3: CHANGELOG**

Add `## [Unreleased]` or dated section listing toolchain bumps, auth 403, backups, compose hardening.

- [ ] **Step 4: Report**

For each issue found during implementation: **Issue → Why it mattered → Fix**. Include any remaining transitive peer warnings with rationale.

- [ ] **Step 5: Commit**

```bash
git add .env.example deploy/env docs CHANGELOG.md
git commit -m "docs: production upgrade migration notes changelog and report"
```

---
