### Task 6: Admin promote CLI

**Files:**

- Create: `apps/api/scripts/promote-admin.mjs`
- Modify: `apps/api/package.json` (script)
- Modify: root `package.json` (convenience script)
- Modify: `apps/api/src/common/services/role-provisioning.service.ts` — extract pure promote helper **only if** needed for DRY; prefer calling Prisma from the script mirroring `ensureBootstrapAdmin` without Nest bootstrap if simpler
- Test: extend `role-provisioning.service.spec.ts` if extracting shared function

**Interfaces:**

- Produces: `pnpm --filter api promote-admin -- --clerk-user-id user_xxx` idempotent ADMIN assign

- [ ] **Step 1: Write failing unit test for promote-by-clerk-id helper**

If extracting `promoteClerkUserToAdmin(prisma, clerkUserId)` into `role-provisioning.service.ts` or `role-provisioning.util.ts`, add a Jest case:

```typescript
it("promotes existing user by clerkUserId to ADMIN idempotently", async () => {
  // arrange user + PENDING_APPROVAL
  // act promoteClerkUserToAdmin
  // assert active ADMIN role; prior pending inactive
})
```

- [ ] **Step 2: Implement helper + CLI**

`apps/api/scripts/promote-admin.mjs` must:

1. Read `DATABASE_URL` / `DIRECT_URL`
2. Parse `--clerk-user-id <id>`
3. Find user by `clerkUserId`
4. Deactivate non-ADMIN roles; ensure active ADMIN (same logic as bootstrap)
5. Exit 0 with log; exit 1 if user missing or ADMIN role missing

Add scripts:

```json
// apps/api/package.json
"promote-admin": "node ./scripts/promote-admin.mjs"

// root package.json
"admin:promote": "pnpm --filter api promote-admin"
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter api test -- role-provisioning
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/scripts/promote-admin.mjs apps/api/package.json package.json apps/api/src/common/services
git commit -m "feat(api): add CLI to promote Clerk user to ADMIN"
```

---
