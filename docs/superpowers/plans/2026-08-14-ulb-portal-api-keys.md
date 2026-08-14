# ULB Portal API Keys Implementation Plan

> **For agentic workers:** Execute inline in this session (user requested implementation). Spec: `docs/superpowers/specs/2026-08-14-ulb-portal-api-keys-design.md`.

**Goal:** Hashed one-active-key-per-ULB M2M auth so `portal.nppetah.in` can `GET /v1/portal/surveys` with `X-API-Key`, plus admin rotate in Nest and Tenants & Wards.

**Architecture:** `UlbApiKey` table (hash + prefix). Portal controller is `@Public()` + `UlbApiKeyGuard`. Portal repository always filters `ulbId` + `deletedAt: null`. Admin `POST /ulbs/:id/api-keys` rotates in a transaction. No Tenant table, no Prisma query extension, no new Next app.

**Tech Stack:** Prisma 7 / PostgreSQL, NestJS 11 ESM, Next.js 16 `apps/web`, Clerk JWT unchanged for humans.

## Global Constraints

- Tenant grain is `Ulb` / `Survey.ulbId` — never add `tenantId`
- Raw key format: `ulb_live_` + 32-byte base64url; store SHA-256 hex; prefix = first 16 chars
- Header: `X-API-Key` (Express: `x-api-key`)
- Missing/unknown/revoked/inactive ULB → 401 `"Invalid API key"`
- One active key per ULB (app transaction + partial unique index)
- `@UlbId()` not `@TenantId()`
- Nest relative imports use `.js` suffixes
- Do not log raw keys or incoming API key headers
- Reuse `@workspace/ui`; no emoji icons; `cursor-pointer` on actions

## File map

| File                                                                            | Responsibility                   |
| ------------------------------------------------------------------------------- | -------------------------------- |
| `packages/database/prisma/schema.prisma`                                        | `UlbApiKey` + Ulb/User relations |
| `packages/database/prisma/migrations/20260814120000_ulb_api_keys/migration.sql` | table + indexes                  |
| `apps/api/src/common/utils/ulb-api-key.util.ts`                                 | generate / hash / prefix         |
| `apps/api/src/common/guards/ulb-api-key.guard.ts`                               | M2M guard                        |
| `apps/api/src/common/decorators/ulb-id.decorator.ts`                            | `@UlbId()`                       |
| `apps/api/src/portal/*`                                                         | `GET /v1/portal/surveys`         |
| `apps/api/src/ulbs/*`                                                           | current + rotate                 |
| `apps/api/src/app.module.ts`                                                    | import `PortalModule`            |
| `apps/web/features/master-data/components/ulb-portal-api-key-card.tsx`          | generate/rotate UI               |
| `apps/web/features/master-data/panels/tenants-wards-panel.tsx`                  | mount card when ULB selected     |

---

### Task 1: Schema + migration

- [x] Add `UlbApiKey` model, `Ulb.apiKeys`, `User.ulbApiKeysCreated`
- [x] SQL migration with unique `keyHash` and partial unique `(ulbId) WHERE isActive`
- [x] `pnpm db:generate`

### Task 2: Key util + tests

- [x] `generateUlbApiKey()`, `hashUlbApiKey()`, `ulbApiKeyPrefix()`
- [x] Known SHA-256 vector; prefix length 16; generated keys start with `ulb_live_`

### Task 3: Guard + decorator

- [x] `UlbApiKeyGuard` hashes header, loads active key + ACTIVE ULB, sets `req.ulbId`
- [x] `@UlbId()` reads `request.ulbId`
- [x] Guard unit tests (missing, garbage, revoked, inactive ULB, success)

### Task 4: Portal module

- [x] `GET /v1/portal/surveys` paginated summary
- [x] Foreign `wardId` → 400 `Ward is not in this ULB`
- [x] Repository tests: ULB filter, deletedAt, ward check, pagination

### Task 5: Admin rotate

- [x] `GET /ulbs/:id/api-keys/current` above `@Get(":id")`
- [x] `POST /ulbs/:id/api-keys` transaction revoke+insert; `settings:manage`
- [x] Permission metadata + rotate tests

### Task 6: Admin UI

- [x] Card on Tenants & Wards when selected ULB and `settings:manage`
- [x] Confirm → POST → reveal-once dialog with Copy

### Task 7: Verify

- [x] `pnpm --filter api test` for new specs
- [x] `pnpm --filter api typecheck` and `pnpm --filter web typecheck`
