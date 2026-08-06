# Baghpat QC Parity Safe Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Nest QC Command Center ward cards match Convex for every Baghpat district ULB via district-scoped reconcile, ward align, and PENDING refresh — without touching Etah while QC is live.

**Architecture:** Require `districtId` on reconcile / refresh-pending / align-wards. Worker lists only Nest PENDING surveys in that district. Transform never defaults unknown Convex status to `SUBMITTED`. Terminal Nest QC stays immutable. Etah is excluded until a later off-hours Phase 2 with Etah `districtId`.

**Tech Stack:** NestJS API (`api-survey-apps`), BullMQ worker, Prisma, `@workspace/etl-core`, Convex HTTP ETL extractor, Admin ETL console (Next.js).

## Global Constraints

- Phase 1 scope: Baghpat `districtId` only; Etah untouched
- Missing `districtId` on scoped endpoints → HTTP 400 (never default to all districts)
- Nest `qcStatus` APPROVED / REJECTED never overwritten
- PENDING refresh only updates field `surveyStatus` / body / geo; keeps `qcStatus=PENDING`
- Do not force Nest global Field Drafts to 1415 in Phase 1
- Spec: `docs/superpowers/specs/2026-08-06-baghpat-qc-parity-safe-sync-design.md`

## File map

| File                                                       | Responsibility                                         |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| `packages/etl-core/src/transform/transform-survey.ts`      | Status mapping; no SUBMITTED default                   |
| `packages/etl-core/src/transform/transform-survey.spec.ts` | Transform tests                                        |
| `packages/etl-core/src/scope/district-scope.ts`            | Pure helpers for scope checks (new)                    |
| `packages/etl-core/src/scope/district-scope.spec.ts`       | Scope helper tests (new)                               |
| `packages/etl-core/src/index.ts`                           | Re-export scope helpers                                |
| `packages/jobs/src/index.ts`                               | Add `districtId` to batch/import payloads              |
| `apps/api/src/etl/dto/etl.dto.ts`                          | DTOs requiring `districtId`                            |
| `apps/api/src/etl/etl.controller.ts`                       | Wire reconcile + gated refresh/align                   |
| `apps/api/src/etl/etl.service.ts`                          | Pass `districtId`; dry-run refresh counts              |
| `apps/api/src/etl/ward-align.service.ts`                   | Filter ULBs/wards by `districtId`                      |
| `apps/api/src/etl/reconcile.service.ts`                    | Nest↔Convex parity report (new)                        |
| `apps/api/src/etl/etl.module.ts`                           | Register reconcile service                             |
| `apps/worker/src/etl/etl-orchestrator.service.ts`          | `listPendingRefreshIds(districtId)`; skip out-of-scope |
| `apps/worker/src/etl/survey-import.processor.ts`           | Propagate `districtId` to children                     |
| `apps/web/features/etl/lib/etl-api.ts`                     | Client helpers with `districtId`                       |
| `apps/web/features/etl/hooks/use-etl-status.ts`            | Mutations with district                                |
| `apps/web/features/etl/etl-console.tsx`                    | District picker + Phase 1 actions                      |

---

### Task 1: Stop defaulting unknown Convex status to SUBMITTED

**Files:**

- Modify: `packages/etl-core/src/transform/transform-survey.ts`
- Modify: `packages/etl-core/src/transform/transform-survey.spec.ts`
- Modify: `packages/etl-core/src/index.ts` (only if new export needed — none)

**Interfaces:**

- Consumes: `mapSurveyStatus`, `ConvexSurveyBundle.status`
- Produces: `transformSurveyBundle` returns `ok: false` when status is missing/unmapped (instead of `"SUBMITTED"`)

- [ ] **Step 1: Write the failing test**

Add to `transform-survey.spec.ts`:

```typescript
it("fails transform when Convex status is missing instead of defaulting to SUBMITTED", () => {
  const result = transformSurveyBundle(fixtureBundle({ status: undefined as unknown as "submitted" }), ctx)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.error).toMatch(/surveyStatus|status/i)
  }
})

it("maps draft to DRAFT", () => {
  const result = transformSurveyBundle(fixtureBundle({ status: "draft", wardNo: "" }), ctx)
  expect(result.ok).toBe(true)
  if (result.ok && !("skip" in result)) {
    expect(result.survey.surveyStatus).toBe("DRAFT")
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/etl-core && pnpm test -- transform-survey.spec.ts`

Expected: FAIL on missing-status case (currently returns SUBMITTED)

- [ ] **Step 3: Write minimal implementation**

In `transform-survey.ts`, replace:

```typescript
surveyStatus: mapSurveyStatus(bundle.status) ?? "SUBMITTED",
```

with:

```typescript
const mappedStatus = mapSurveyStatus(bundle.status)
if (!mappedStatus) {
  return {
    ok: false,
    legacySurveyId,
    stage: "TRANSFORM",
    error: `Missing or unmapped Convex status (${bundle.status ?? "undefined"})`,
  }
}
// ... later in mapped object:
surveyStatus: mappedStatus,
```

Keep `qcStatus: mapQcStatus(bundle.qcStatus) ?? "PENDING"` (PENDING default is intentional for field imports).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/etl-core && pnpm test -- transform-survey.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd api-survey-apps
git add packages/etl-core/src/transform/transform-survey.ts packages/etl-core/src/transform/transform-survey.spec.ts
git commit -m "fix(etl): do not default unmapped Convex status to SUBMITTED"
```

---

### Task 2: District scope helpers + job payload field

**Files:**

- Create: `packages/etl-core/src/scope/district-scope.ts`
- Create: `packages/etl-core/src/scope/district-scope.spec.ts`
- Modify: `packages/etl-core/src/index.ts`
- Modify: `packages/jobs/src/index.ts`

**Interfaces:**

- Consumes: none
- Produces:
  - `assertDistrictId(districtId: string | null | undefined): string` — throws `Error` with message `districtId is required`
  - `isSurveyInDistrictScope(surveyDistrictId: string | null | undefined, scopeDistrictId: string): boolean`
  - `EtlSurveyBatchPayload.districtId?: string`
  - `EtlSurveyImportPayload.districtId?: string`

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/etl-core/src/scope/district-scope.spec.ts
import { describe, expect, it } from "@jest/globals"
import { assertDistrictId, isSurveyInDistrictScope } from "./district-scope.js"

describe("district-scope", () => {
  it("assertDistrictId rejects empty", () => {
    expect(() => assertDistrictId(undefined)).toThrow(/districtId is required/)
    expect(() => assertDistrictId("")).toThrow(/districtId is required/)
  })

  it("assertDistrictId trims and returns id", () => {
    expect(assertDistrictId("  dist-1  ")).toBe("dist-1")
  })

  it("isSurveyInDistrictScope matches exactly", () => {
    expect(isSurveyInDistrictScope("d1", "d1")).toBe(true)
    expect(isSurveyInDistrictScope("d2", "d1")).toBe(false)
    expect(isSurveyInDistrictScope(null, "d1")).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/etl-core && pnpm test -- district-scope.spec.ts`

Expected: FAIL (module missing)

- [ ] **Step 3: Implement helpers + payload types**

```typescript
// packages/etl-core/src/scope/district-scope.ts
export function assertDistrictId(districtId: string | null | undefined): string {
  const id = districtId?.trim() ?? ""
  if (!id) throw new Error("districtId is required")
  return id
}

export function isSurveyInDistrictScope(surveyDistrictId: string | null | undefined, scopeDistrictId: string): boolean {
  return Boolean(surveyDistrictId) && surveyDistrictId === scopeDistrictId
}
```

Export from `packages/etl-core/src/index.ts`.

In `packages/jobs/src/index.ts`, add optional `districtId?: string` to `EtlSurveyBatchPayload` and `EtlSurveyImportPayload`.

- [ ] **Step 4: Run tests**

Run: `cd packages/etl-core && pnpm test -- district-scope.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/etl-core/src/scope packages/etl-core/src/index.ts packages/jobs/src/index.ts
git commit -m "feat(etl): add district scope helpers and job payload districtId"
```

---

### Task 3: Worker — filter PENDING refresh by districtId

**Files:**

- Modify: `apps/worker/src/etl/etl-orchestrator.service.ts`
- Modify: `apps/worker/src/etl/survey-import.processor.ts`
- Test: add `apps/worker/src/etl/list-pending-refresh-ids.spec.ts` if worker has jest; otherwise cover via API dry-run in Task 4. Prefer a small unit test of the `where` clause builder extracted as:

**Interfaces:**

- Consumes: `assertDistrictId`, `isSurveyInDistrictScope`, `EtlSurveyBatchPayload.districtId`
- Produces:
  - `listPendingRefreshIds(cursor, batchSize, districtId: string)`
  - Import path skips when `payload.districtId` set and Nest survey district mismatches (`outcome: "skipped"`, log `skippedOutOfScope`)

- [ ] **Step 1: Extract / implement scoped list**

Change signature:

```typescript
async listPendingRefreshIds(
  cursor: string | null,
  batchSize = DEFAULT_ETL_BATCH_SIZE,
  districtId?: string
) {
  const scope = assertDistrictId(districtId) // refresh-pending MUST pass districtId
  const take = Math.max(1, Math.min(batchSize, 500))
  const rows = await this.prisma.db.survey.findMany({
    where: {
      deletedAt: null,
      qcStatus: QcStatus.PENDING,
      legacySurveyId: { not: null },
      districtId: scope,
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take,
    select: { id: true, legacySurveyId: true },
  })
  // ... same return shape
}
```

- [ ] **Step 2: Propagate districtId in processor**

In `survey-import.processor.ts` `processBatch`:

```typescript
const page =
  payload.type === "REFRESH_PENDING" || payload.refreshPending
    ? await this.orchestrator.listPendingRefreshIds(payload.cursor, payload.batchSize, payload.districtId)
    : await this.orchestrator.listBatchIds(payload.cursor, payload.batchSize)

const child: EtlSurveyImportPayload = {
  // ...existing
  districtId: payload.districtId,
  refreshPending: payload.type === "REFRESH_PENDING" || payload.refreshPending === true,
}
```

When enqueueing next batch, copy `districtId` onto the next `EtlSurveyBatchPayload`.

- [ ] **Step 3: Defense in depth on import**

At start of `processSurveyImport`, after loading Nest survey (or after bundle geo resolve), if `payload.districtId` is set:

```typescript
if (payload.districtId) {
  const nest = await this.prisma.db.survey.findFirst({
    where: { legacySurveyId, deletedAt: null },
    select: { districtId: true, qcStatus: true },
  })
  if (nest && !isSurveyInDistrictScope(nest.districtId, payload.districtId)) {
    await this.appendLog(migrationJobId, "info", "Skipped: out of district scope", legacySurveyId, correlationId)
    return { outcome: "skipped", imagesUploaded: 0, imagesDownloaded: 0, missingImages: 0 }
  }
}
```

Keep existing terminal QC skip.

- [ ] **Step 4: Typecheck worker**

Run: `cd apps/worker && pnpm typecheck` (or repo turbo typecheck for worker)

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/etl/etl-orchestrator.service.ts apps/worker/src/etl/survey-import.processor.ts
git commit -m "feat(etl): scope refresh-pending listing and imports by districtId"
```

---

### Task 4: API — require districtId on refresh-pending + dry-run counts

**Files:**

- Modify: `apps/api/src/etl/dto/etl.dto.ts`
- Modify: `apps/api/src/etl/etl.service.ts`
- Modify: `apps/api/src/etl/etl.controller.ts`
- Modify: `apps/api/src/etl/etl.contract.spec.ts` (if present; extend assertions)

**Interfaces:**

- Consumes: `assertDistrictId`
- Produces:
  - `RefreshPendingDto { districtId: string; apply: boolean; batchSize?: number }`
  - `startRefreshPending(userId, dto)` → if `apply===false`, return counts without enqueue; if `true`, enqueue with `districtId`

- [ ] **Step 1: Add DTO**

```typescript
export class RefreshPendingDto {
  @IsString()
  districtId!: string

  @IsBoolean()
  apply!: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  batchSize?: number
}
```

- [ ] **Step 2: Implement dry-run + apply in EtlService**

```typescript
async startRefreshPending(userId: string, dto: { districtId: string; apply: boolean; batchSize?: number }) {
  this.assertEtlConfigured()
  const districtId = assertDistrictId(dto.districtId)

  const district = await this.prisma.db.district.findUnique({
    where: { id: districtId },
    select: { id: true, name: true },
  })
  if (!district) throw new BadRequestException(`Unknown districtId: ${districtId}`)

  const where = {
    deletedAt: null,
    qcStatus: "PENDING" as const,
    legacySurveyId: { not: null },
    districtId,
  }
  const wouldUpdate = await this.prisma.db.survey.count({ where })

  if (!dto.apply) {
    return {
      mode: "dry-run" as const,
      districtId,
      districtName: district.name,
      wouldUpdate,
      wouldSkipTerminal: 0,
      jobId: null,
    }
  }

  // existing job create + enqueueEtlSurveyBatch, plus districtId on payload
  await this.jobs.enqueueEtlSurveyBatch({
    migrationJobId: migrationJob.id,
    correlationId,
    type: "REFRESH_PENDING",
    cursor: null,
    batchSize: size,
    createdById: userId,
    refreshPending: true,
    districtId,
  })
  return { mode: "apply" as const, districtId, districtName: district.name, wouldUpdate, jobId: migrationJob.id, correlationId }
}
```

Controller:

```typescript
refreshPending(@CurrentUser() user: AuthenticatedUser, @Body() body: RefreshPendingDto) {
  return this.etlService.startRefreshPending(user.id, body)
}
```

- [ ] **Step 3: Contract / validation test**

Assert missing `districtId` → 400 (use existing etl.contract.spec pattern or a unit test on DTO validation).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/etl/dto/etl.dto.ts apps/api/src/etl/etl.service.ts apps/api/src/etl/etl.controller.ts apps/api/src/etl/etl.contract.spec.ts
git commit -m "feat(etl): require districtId on refresh-pending with dry-run counts"
```

---

### Task 5: Scope align-wards-with-convex by districtId

**Files:**

- Modify: `apps/api/src/etl/dto/etl.dto.ts` (`AlignWardsDto`)
- Modify: `apps/api/src/etl/ward-align.service.ts`
- Modify: `apps/api/src/etl/etl.controller.ts`

**Interfaces:**

- Consumes: `assertDistrictId`
- Produces: `alignWardsWithConvex(apply: boolean, districtId: string)` only processes ULBs where `ulb.districtId === districtId`

- [ ] **Step 1: Extend AlignWardsDto**

```typescript
export class AlignWardsDto {
  @IsBoolean()
  apply!: boolean

  @IsString()
  districtId!: string

  @IsOptional()
  @IsString()
  ulbCode?: string
}
```

Note: `districtId` becomes required for `align-wards-with-convex`. Keep `ulbCode` optional for further narrowing inside the district. For `dedupe-wards` / `sync-wards-from-convex` advanced buttons: also require `districtId` when called from Phase 1 UI; if advanced endpoints stay global, leave them but do not use them during Phase 1.

- [ ] **Step 2: Filter align pipeline**

In `alignWardsWithConvex(apply, districtId)`:

1. `const scope = assertDistrictId(districtId)`
2. Resolve ULB codes for that district: `prisma.ulb.findMany({ where: { districtId: scope }, select: { code: true, id: true } })`
3. Pass ULB allowlist into `dedupeWards` / `syncWardsFromConvex` / `remapOrphanedSurveys` so only those ULBs are touched
4. Skip `cleanupEmptyDuplicateStates` when scoped (state cleanup is global — do not run in Phase 1 scoped align), OR run cleanup only if `districtId` is absent (Phase 1 never calls unscoped)

Minimal approach matching safety: when `districtId` is set, **skip** `cleanupEmptyDuplicateStates` entirely and filter dedupe/sync/verify to that district’s ULBs.

- [ ] **Step 3: Controller**

```typescript
alignWardsWithConvex(@Body() body: AlignWardsDto) {
  return this.wardAlign.alignWardsWithConvex(body.apply, body.districtId)
}
```

- [ ] **Step 4: Typecheck API**

Run: `cd apps/api && pnpm typecheck`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/etl/dto/etl.dto.ts apps/api/src/etl/ward-align.service.ts apps/api/src/etl/etl.controller.ts
git commit -m "feat(etl): scope align-wards-with-convex to districtId"
```

---

### Task 6: Reconcile endpoint (read-only)

**Files:**

- Create: `apps/api/src/etl/reconcile.service.ts`
- Create: `apps/api/src/etl/reconcile.service.spec.ts` (mock prisma + extractor)
- Modify: `apps/api/src/etl/dto/etl.dto.ts` — `ReconcileDto { districtId: string }`
- Modify: `apps/api/src/etl/etl.controller.ts` — `POST /etl/reconcile-with-convex`
- Modify: `apps/api/src/etl/etl.module.ts`

**Interfaces:**

- Consumes: Convex extractor `getSurveyBundles`, Prisma surveys for district
- Produces:

```typescript
type ReconcileResult = {
  districtId: string
  districtName: string
  totals: {
    nestSurveys: number
    withLegacyId: number
    ok: number
    statusMismatch: number
    wardMismatch: number
    onlyNest: number
    onlyConvexSampled: number
  }
  byUlb: Array<{
    ulbCode: string
    ulbName: string
    ok: number
    statusMismatch: number
    wardMismatch: number
    onlyNest: number
  }>
  samples: {
    statusMismatch: Array<{ legacySurveyId: string; nestStatus: string; convexStatus: string; wardNo: string }>
    wardMismatch: Array<{ legacySurveyId: string; nestWard: string; convexWard: string }>
    onlyNest: Array<{ surveyId: string; legacySurveyId: string | null }>
  }
}
```

- [ ] **Step 1: Implement Nest-driven reconcile**

Algorithm:

1. Assert `districtId`; load district + ULBs.
2. Page Nest surveys `where: { districtId, deletedAt: null }` (select id, legacySurveyId, surveyStatus, wardNumber, ulbId, qcStatus).
3. For rows with `legacySurveyId`, batch `getSurveyBundles` (max 50).
4. Compare:
   - Convex missing → `onlyNest`
   - `mapSurveyStatus(convex.status) !== nest.surveyStatus` (and nest qc still PENDING) → `statusMismatch`
   - normalized ward numbers differ → `wardMismatch`
   - else → `ok`
5. Optional `onlyConvex`: page Convex list IDs, fetch bundles, keep those whose `municipalityCode` is in Baghpat ULB codes and whose `_id` is not in Nest set — count + sample (cap samples at 20).

Do not write any Nest rows.

- [ ] **Step 2: Unit test with mocks**

Cover: one statusMismatch, one ok, one onlyNest; missing districtId throws.

- [ ] **Step 3: Wire controller**

```typescript
@Post("reconcile-with-convex")
@RequirePermission(PERMISSIONS.ETL_MANAGE)
@Throttle({ default: { limit: 5, ttl: 60_000 } })
reconcile(@Body() body: ReconcileDto) {
  return this.reconcileService.reconcileWithConvex(body.districtId)
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/etl/reconcile.service.ts apps/api/src/etl/reconcile.service.spec.ts apps/api/src/etl/dto/etl.dto.ts apps/api/src/etl/etl.controller.ts apps/api/src/etl/etl.module.ts
git commit -m "feat(etl): add read-only reconcile-with-convex for a district"
```

---

### Task 7: ETL console — district picker for Phase 1 actions

**Files:**

- Modify: `apps/web/features/etl/lib/etl-api.ts`
- Modify: `apps/web/features/etl/hooks/use-etl-status.ts`
- Modify: `apps/web/features/etl/etl-console.tsx`

**Interfaces:**

- Consumes: `/districts` list (existing `useDistricts` / geo hooks)
- Produces: UI requires selected district before Align / Refresh / Reconcile; shows dry-run results

- [ ] **Step 1: Update client API**

```typescript
export function startEtlRefreshPending(opts: { districtId: string; apply: boolean; batchSize?: number }) {
  return apiPost("/etl/refresh-pending", opts)
}

export function alignWardsWithConvex(apply: boolean, districtId: string) {
  return apiPost<AlignWardsPipelineResult>("/etl/align-wards-with-convex", { apply, districtId })
}

export function reconcileWithConvex(districtId: string) {
  return apiPost("/etl/reconcile-with-convex", { districtId })
}
```

- [ ] **Step 2: Update hooks**

Pass `{ districtId, apply }` into mutations; toast errors when district missing.

- [ ] **Step 3: Console UX**

Add a District `<Select>` near Phase 1 actions (Align Wards / Refresh PENDING / Reconcile). Disable buttons until a district is selected. Label helper text: “Phase 1: select Baghpat only — Etah QC is live; do not select Etah until off-hours.”

Flow buttons:

1. Reconcile (always dry)
2. Align dry-run → confirm dialog → Align apply
3. Refresh dry-run (`apply: false`) → confirm → Refresh apply (`apply: true`)

- [ ] **Step 4: Manual UI check**

Run web app locally; confirm buttons disabled without district; confirm payload includes `districtId`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/etl/lib/etl-api.ts apps/web/features/etl/hooks/use-etl-status.ts apps/web/features/etl/etl-console.tsx
git commit -m "feat(etl-ui): district-scoped reconcile, align, and refresh-pending"
```

---

### Task 8: Ops smoke checklist (Baghpat) — documentation only

**Files:**

- Create: `docs/superpowers/plans/2026-08-06-baghpat-qc-parity-ops-checklist.md`  
  OR append a “Phase 1 runbook” section to `docs/etl/RUNBOOK.md`

- [ ] **Step 1: Write runbook steps**

Exact operator sequence:

1. Confirm Etah QC still working (sanity).
2. ETL console → select district **Baghpat**.
3. Reconcile → save/export totals.
4. Align dry-run → apply.
5. Refresh dry-run → apply; watch job until COMPLETED.
6. Reconcile again → `statusMismatch` near 0 for PENDING rows.
7. Open Nest + Convex QC Command Centers for each Baghpat ULB; compare Field Drafts / QC Pending / QC Approved.
8. Spot-check Aminnagar Ward 6.
9. Confirm Etah queues unchanged.
10. Stop (no Etah run).

- [ ] **Step 2: Commit**

```bash
git add docs/etl/RUNBOOK.md
git commit -m "docs(etl): Baghpat Phase 1 safe sync runbook"
```

---

## Self-review (plan vs spec)

| Spec requirement                                | Task                               |
| ----------------------------------------------- | ---------------------------------- |
| Reconcile read-only with `districtId`           | Task 6                             |
| refresh-pending requires `districtId` + dry-run | Task 4 + Task 3                    |
| Align scoped to Baghpat / district              | Task 5                             |
| Terminal QC immutable                           | Task 3 (existing skip) + Task 4    |
| No SUBMITTED default                            | Task 1                             |
| ETL console district picker                     | Task 7                             |
| Etah untouched / ops sequence                   | Task 8 + Global Constraints        |
| Global drafts not forced to 1415                | Documented; no task deletes drafts |
| Worker `skippedOutOfScope`                      | Task 3                             |

No TBD placeholders remain. Payload field name `districtId` is consistent across jobs, DTO, worker, and UI.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-06-baghpat-qc-parity-safe-sync.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach?
