# ULB portal API keys (M2M)

**Date:** 2026-08-14  
**Status:** Approved for planning (Approach 1 — dedicated portal module + explicit `ulbId` filters)  
**App:** `api-survey-apps`  
**Problem:** External client portals (starting with `portal.nppetah.in`) need a server-to-server way to list surveys from Nest without forwarding a Clerk user JWT. Nest must identify the municipality from a hashed API key and return only that ULB’s surveys.

## Goals

- Store hashed ULB API keys; return the raw key only once at generation.
- One active key per ULB; generating a new key immediately revokes the previous key.
- `GET /v1/portal/surveys` authenticates with `X-API-Key` only and returns a paginated survey summary for that ULB.
- Admins with `settings:manage` generate/rotate keys from Nest and from Tenants & Wards when a ULB is selected.
- Keep Clerk JWT auth for `apps/web` and existing `/surveys` routes.

## Non-goals

- A `Tenant` model or `tenantId` column on surveys (tenant grain remains `Ulb` / `ulbId`).
- A new `apps/client-portal` (or `apps/admin`) Next app in this monorepo.
- Prisma Client query extensions that auto-inject `where` (nested `include` / `connect` do not go through those callbacks; shared `PrismaService` would leak scope into admin/worker).
- Replacing portal Clerk login; Clerk still authenticates officers in the external portal. Nest does not see the officer on M2M routes.
- Clerk machine tokens, HMAC pepper, `lastUsedAt`, or per-user ward scoping on portal M2M reads.
- Changing dual Clerk JWT verification (`CLERK_SECRET_KEY` + `PORTAL_CLERK_SECRET_KEY`) for human sessions.

## Locked decisions

| Topic                   | Choice                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Tenant grain            | Existing `Ulb` (`Survey.ulbId`). No parallel Tenant table.                                                                        |
| Portal identity at Nest | API key only. Every signed-in portal user sees the same ULB dataset. Clerk session is the portal app’s UI gate, not a Nest claim. |
| Key lifecycle           | One active key per ULB. Rotate = revoke current + insert new in one transaction.                                                  |
| Header                  | `X-API-Key`                                                                                                                       |
| Raw key                 | `ulb_live_` + 32 cryptographically random bytes as base64url                                                                      |
| Stored secret           | SHA-256 hex of the full raw key (`keyHash`, unique). `keyPrefix` is the first 16 characters of the raw key for admin display.     |
| Lookup failures         | Same 401 body `Invalid API key` for missing, unknown, revoked, and inactive ULB                                                   |
| Portal path             | `GET /v1/portal/surveys` on a dedicated controller. Rest of the API stays unversioned (`/surveys`, `/ulbs`, …).                   |
| Admin APIs              | `GET /ulbs/:id/api-keys/current`, `POST /ulbs/:id/api-keys`                                                                       |
| Admin permission        | `settings:manage` plus existing geo tenant scope for that `ulbId`                                                                 |
| Admin UI                | Portal API key card on Tenants & Wards when a ULB node is selected                                                                |
| Isolation               | Explicit `where: { ulbId, deletedAt: null }` in the portal repository. Not a Prisma extension.                                    |
| Decorator               | `@UlbId()` (not `@TenantId()`)                                                                                                    |

## Architecture

```
portal.nppetah.in (external Next, Clerk instance B)
  1. Verify local Clerk session (portal app only)
  2. Server fetch GET {NEST}/v1/portal/surveys
     Header: X-API-Key: <raw key from portal env>

apps/web (Clerk instance A)
  POST /ulbs/:id/api-keys     → rotate, return rawKey once
  GET  /ulbs/:id/api-keys/current → prefix only

apps/api
  Global: Throttler → ClerkAuthGuard → PermissionsGuard → TenantGuard
  Portal controller: @Public() + UlbApiKeyGuard
  Portal repository: Survey.ulbId = req.ulbId
```

`@Public()` already skips Clerk and permission checks (health, demand-notice print). `TenantGuard` no-ops when `request.user` is absent. Portal routes therefore do not require a Bearer token. Global throttle (120 / 60s) still applies.

Admin rotate routes are **not** public: they use Clerk + `settings:manage` + tenant scope like other ULB mutations.

## Schema

Package: `packages/database` (not `packages/db`).

```prisma
model UlbApiKey {
  id          String    @id @default(cuid())
  ulbId       String
  keyHash     String    @unique
  keyPrefix   String
  isActive    Boolean   @default(true)
  createdById String?
  createdAt   DateTime  @default(now())
  revokedAt   DateTime?

  ulb       Ulb   @relation(fields: [ulbId], references: [id], onDelete: Restrict)
  createdBy User? @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@index([ulbId, isActive])
  @@map("ulb_api_keys")
}
```

`Ulb` gains `apiKeys UlbApiKey[]`. `User` gains the inverse relation for `createdBy`.

SQL migration also adds a partial unique index (same pattern as active wards):

```sql
CREATE UNIQUE INDEX "ulb_api_keys_ulbId_active_key"
  ON "ulb_api_keys" ("ulbId")
  WHERE "isActive" = true;
```

`Survey` is unchanged. Do not add `tenantId`.

### Key material

- Generate with `crypto.randomBytes(32).toString("base64url")`, prefixed `ulb_live_`.
- `keyHash = sha256(utf8(rawKey)).digest("hex")`.
- `keyPrefix = rawKey.slice(0, 16)` (enough to recognize a key in the UI; not enough to reconstruct it).
- Incoming header is hashed the same way and looked up by unique `keyHash` where `isActive = true`.
- Do not log raw keys, request header values, or hashes of incoming keys.

## NestJS modules

### Hash helper

`apps/api/src/common/utils/ulb-api-key.util.ts` — `generateUlbApiKey()`, `hashUlbApiKey(raw: string)`, `ulbApiKeyPrefix(raw: string)`. Colocated unit tests with a known SHA-256 vector.

### Guard and decorator

- `apps/api/src/common/guards/ulb-api-key.guard.ts`
- `apps/api/src/common/decorators/ulb-id.decorator.ts` (`createParamDecorator`, reads `request.ulbId`)
- Register the guard on the portal controller only (`@UseGuards(UlbApiKeyGuard)`), not as `APP_GUARD`.

Guard steps:

1. Read `X-API-Key` (string; reject arrays / empty).
2. Hash and `findUnique` on `keyHash`.
3. Reject when missing, `isActive === false`, or related ULB `status !== ACTIVE`.
4. Set `request.ulbId = record.ulbId`.

### Portal feature

```
apps/api/src/portal/
  portal.module.ts
  portal-surveys.controller.ts
  portal-surveys.service.ts
  portal-surveys.repository.ts
  dto/portal-survey-query.dto.ts
  *.spec.ts
```

`@Controller("v1/portal")` + `@Public()` + `@UseGuards(UlbApiKeyGuard)` + `@ApiTags("portal")`.

`GET /surveys` → `GET /v1/portal/surveys`.

Query DTO extends `PaginationQueryDto` (`page`, `limit` 1–100, `search`, `sortBy`, `sortOrder`) plus optional `wardId`. Allowed `sortBy`: `createdAt`, `parcelNumber`, `propertyId`, `surveyStatus`. Default `createdAt desc`.

Repository `where`:

- always `ulbId` from `@UlbId()` and `deletedAt: null`
- optional `wardId` only if that ward’s `ulbId` matches; otherwise `400`
- `search` ILIKE on `propertyId`, `parcelNumber`, `respondentName` (same style as existing survey search)

Select / map to:

```ts
{
  id: string
  propertyId: string
  parcelNumber: string | null
  surveyStatus: SurveyStatus
  qcStatus: QcStatus
  respondentName: string | null
  assessmentYear: AssessmentYear
  ward: {
    id: string
    wardNumber: string
    wardName: string
  }
}
```

Return `toPaginatedResult` inside the existing success envelope. Do not include floors, photos, tax fields, or owner PII beyond `respondentName`.

Wire `PortalModule` in `app.module.ts`. Do not put Prisma in the controller.

### Admin rotate (ULBs module)

On `UlbsController` (Clerk + existing geo guards):

| Method | Path                         | Permission        | Response `data`                              |
| ------ | ---------------------------- | ----------------- | -------------------------------------------- |
| GET    | `/ulbs/:id/api-keys/current` | `settings:manage` | `{ keyPrefix, createdAt, isActive } \| null` |
| POST   | `/ulbs/:id/api-keys`         | `settings:manage` | `{ rawKey, keyPrefix, ulbId, createdAt }`    |

Declare these handlers **above** `@Get(":id")` / `@Patch(":id")` on `UlbsController` so Nest does not treat `api-keys` as an id. Paths stay parameterized (`:id/api-keys/current`); do not add a competing `/ulbs/api-keys` collection route.

POST transaction:

1. Confirm caller `canAccessTenant` for that ULB (same as other ULB writes).
2. Set any active key for `ulbId` to `isActive: false`, `revokedAt: now`.
3. Insert the new row with `createdById = user.id`.
4. Return `rawKey` only in this response.

GET never returns `rawKey` or `keyHash`.

## Admin UI

`apps/web` Tenants & Wards (`tenants-wards-panel.tsx`), ULB selected, `hasPermission("settings:manage")`:

- Card title: Portal API key.
- No key: copy “No active key” + **Generate**.
- Active key: monospace `keyPrefix`, created date, **Rotate**.
- Confirm dialog before POST: previous key stops working immediately; new secret is shown only once.
- Success dialog: monospace `rawKey`, **Copy**, Close. After close, UI refetches current metadata (prefix only).
- Errors: existing `getApiErrorMessage` toast.
- Hide the card without `settings:manage`. Lucide icons (e.g. `KeyRound`); no emoji icons. `cursor-pointer` on actions. Reuse `@workspace/ui` Dialog / Button.

## External portal contract

Not implemented in this repo. Operators of `portal.nppetah.in` should store the one-time raw key as a **server** env (`TENANT_API_KEY`, never `NEXT_PUBLIC_*`), verify the local Clerk session, then call Nest. CORS already allows `https://portal.nppetah.in`.

Example for the external App Router (not added to this monorepo):

```tsx
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

type PortalSurveyList = {
  items: Array<{
    id: string
    propertyId: string
    parcelNumber: string | null
    surveyStatus: string
    qcStatus: string
    respondentName: string | null
    assessmentYear: string
    ward: { id: string; wardNumber: string; wardName: string }
  }>
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export default async function SurveysPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const apiKey = process.env.TENANT_API_KEY
  const apiUrl = process.env.NEST_API_URL
  if (!apiKey || !apiUrl) {
    throw new Error("TENANT_API_KEY and NEST_API_URL must be set")
  }

  const res = await fetch(`${apiUrl}/v1/portal/surveys?page=1&limit=20`, {
    headers: { "X-API-Key": apiKey },
    cache: "no-store",
  })
  const body: { success: boolean; data: PortalSurveyList | null; message: string } = await res.json()
  if (!res.ok || !body.success || !body.data) {
    throw new Error(body.message || "Failed to load surveys")
  }

  return (
    <ul>
      {body.data.items.map((row) => (
        <li key={row.id}>
          {row.propertyId} · {row.ward.wardNumber} - {row.ward.wardName}
        </li>
      ))}
    </ul>
  )
}
```

## Error handling

| Case                                        | Status | Message                  |
| ------------------------------------------- | ------ | ------------------------ |
| Missing / blank / unknown / revoked API key | 401    | Invalid API key          |
| ULB `status !== ACTIVE`                     | 401    | Invalid API key          |
| `wardId` not in keyed ULB                   | 400    | Ward is not in this ULB  |
| Admin without `settings:manage`             | 403    | existing permission copy |
| Admin ULB outside tenant scope              | 403    | existing tenant copy     |
| ULB id not found                            | 404    | existing geo not-found   |

Rotate must not leave two active rows: rely on the transaction plus the partial unique index. Concurrent POSTs: one succeeds, the other hits unique violation → map to 409 via existing `P2002` handling or retry once inside the service.

## Testing

- Hash util: known SHA-256 hex for a fixture string; prefix length 16; generated keys start with `ulb_live_`.
- Guard: missing header, garbage key, revoked key, inactive ULB → 401; valid key sets `ulbId`.
- Portal list: only the keyed ULB; `deletedAt` excluded; foreign `wardId` → 400; pagination `meta` present; Clerk Bearer without API key still 401 on this route.
- Rotate: after POST, old raw key 401 and new raw key 200; at most one `isActive` row per ULB.
- Admin: missing `settings:manage` → 403; out-of-scope ULB → 403; GET current never includes `rawKey`.
- Logging interceptor / tests: assert generate response is not written at info level with `rawKey` (redact in service logs).

## Implementation sketch

| Area                                                 | Change                         |
| ---------------------------------------------------- | ------------------------------ |
| `packages/database/prisma/schema.prisma`             | `UlbApiKey` + relations        |
| `packages/database/prisma/migrations/`               | table + partial unique index   |
| `apps/api/src/common/utils/ulb-api-key.util.ts`      | generate / hash / prefix       |
| `apps/api/src/common/guards/ulb-api-key.guard.ts`    | M2M guard                      |
| `apps/api/src/common/decorators/ulb-id.decorator.ts` | `@UlbId()`                     |
| `apps/api/src/portal/`                               | list endpoint                  |
| `apps/api/src/ulbs/`                                 | current + rotate               |
| `apps/api/src/app.module.ts`                         | import `PortalModule`          |
| `apps/web` Tenants & Wards                           | generate/rotate card + dialogs |
| `apps/web/lib/api` + hooks                           | typed client helpers           |

## Success criteria

1. Etah (or any ULB) can hold exactly one active hashed key.
2. Portal `GET /v1/portal/surveys` with that key returns only that ULB’s non-deleted surveys as a paginated summary.
3. Rotate invalidates the previous key immediately; raw key appears only on the POST response and the one-time UI dialog.
4. Admin `GET /surveys` with Clerk JWT is unchanged.
5. No `Tenant` table, no Prisma auto-scope extension, no new Next app.
