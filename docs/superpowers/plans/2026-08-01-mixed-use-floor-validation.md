# Mixed-Use Floor Soft Validation — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Soft-warn QC on mixed-use floor/area/classification inconsistencies without blocking saves or approval.

**Architecture:** Pure `evaluateMixedUseFloorWarnings` in `@workspace/validation`; attach `warnings` on QC survey detail and floors CRUD; minimal QC alert panel.

**Tech Stack:** NestJS, Prisma (unchanged schema), Next.js QC UI, Jest for unit tests.

**Spec:** [2026-08-01-mixed-use-floor-validation-design.md](../specs/2026-08-01-mixed-use-floor-validation-design.md)

## Global Constraints

- Soft warnings only — never reject writes for catalog codes
- No Prisma migration
- No tax/Excel/registry changes
- Do not auto-set `propertyUse`

## File map

| File                                               | Responsibility                                 |
| -------------------------------------------------- | ---------------------------------------------- |
| `packages/validation/src/floor-usage-warnings.ts`  | Evaluator + types                              |
| `packages/validation/src/index.ts`                 | Re-export                                      |
| `apps/api/src/floors/floor-usage-warnings.spec.ts` | Unit tests                                     |
| `apps/api/src/floors/floors.service.ts`            | Attach warnings on CRUD                        |
| `apps/api/src/qc/qc-survey.mapper.ts`              | Extend DTO with warnings                       |
| `apps/api/src/qc/qc.service.ts`                    | Compute warnings on GET/correct                |
| `apps/web/lib/api/types.ts`                        | `FloorUsageWarning`, `QcSurveyDetail.warnings` |
| `apps/web/components/qc/qc-review-sections.tsx`    | Warning panel + optional floor sums            |
| `apps/web/components/qc/qc-floor-editor.tsx`       | Optional derived per-floor totals              |

## Tasks

### Task 1: Evaluator + tests

- [ ] Add `floor-usage-warnings.ts` with codes, messages, tolerance `0.01`
- [ ] Export from `index.ts`
- [ ] Jest coverage: clean mix, mismatch, exceed plot/plinth, built-up drift, MIXED ambiguous, empty floors
- [ ] Run `pnpm --filter api test -- floor-usage-warnings`

### Task 2: API wiring

- [ ] Helper to map survey+floors → evaluator input
- [ ] `QcSurveyDetailDto.warnings`; set in `getSurveyDetail` and `correct`
- [ ] Floors service: after create/update/delete, load survey+floors, return `warnings`

### Task 3: QC UI

- [ ] Types for `FloorUsageWarning`
- [ ] Alert list in Taxation & Floor Details
- [ ] Derived per-floor area sums near floor editor (read-only)

### Task 4: Verify

- [ ] Duplicate still hard-fails (existing floors.repository.spec)
- [ ] Typecheck / focused tests pass
