# Align Wards with Convex Pipeline — Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox syntax.

**Goal:** One ETL button runs dry-run → confirm → apply for Dedupe → Sync → Cleanup → Verify so Nest wards match Convex catalog.

**Architecture:** `WardAlignService.alignWardsWithConvex(apply)` orchestrates existing steps; `POST /etl/align-wards-with-convex`; ETL console primary CTA.

**Tech Stack:** NestJS, Prisma, Next.js ETL console, existing Convex `list-ward-catalog`.

## Global Constraints

- Wards/ULBs only — no refresh-pending / KPI sync
- Keep UP `09`; cleanup empty `01` / `UP` / `UP-01` only
- SkipThrottle or high limit on pipeline route
- Avoid double-dedupe when pipeline calls sync

---

### Task 1: Pipeline orchestrator

**Files:**

- Modify: `apps/api/src/etl/ward-align.service.ts`

- [ ] Add `alignWardsWithConvex(apply: boolean)` composing dedupe → sync (no internal pre-dedupe) → cleanup → verify
- [ ] Add `skipPreDedupe?: boolean` (or options arg) to `syncWardsFromConvex`
- [ ] Return response shape from spec (`mode`, `ok`, `steps`)

### Task 2: Controller + DTO

**Files:**

- Modify: `apps/api/src/etl/dto/etl.dto.ts`
- Modify: `apps/api/src/etl/etl.controller.ts`

- [ ] Reuse `AlignWardsDto` (`apply: boolean`)
- [ ] `POST align-wards-with-convex` with `@SkipThrottle()` + `etl:manage`

### Task 3: Web UI

**Files:**

- Modify: `apps/web/features/etl/lib/etl-api.ts`
- Modify: `apps/web/features/etl/hooks/use-etl-status.ts`
- Modify: `apps/web/features/etl/etl-console.tsx`

- [ ] Client + mutation for pipeline
- [ ] Primary button: dry-run → dialog → apply → show step report

### Task 4: Smoke

- [ ] Typecheck touched files; dry-run response shape documented in UI
