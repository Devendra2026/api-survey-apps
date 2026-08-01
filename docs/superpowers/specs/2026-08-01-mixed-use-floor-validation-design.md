# Mixed-Use Floor Classification: Soft Validation

**Date:** 2026-08-01  
**Status:** Approved  
**App:** `api-survey-apps`  
**Approach:** Shared soft-warning evaluator on existing multi-row Floor model

## Problem

A property can have Residential and Commercial (and other) usages on different floors or on the same floor. The data model already stores mixed use as multiple `Floor` rows sharing `floorPosition` with different `usageFactor`. QC still needs clear soft validation so supervisors can spot classification and area inconsistencies without blocking saves or approval.

## Locked decisions

| Decision      | Choice                                                                     |
| ------------- | -------------------------------------------------------------------------- |
| Scope         | Rules + validation only (not full QC tree UI or tax/Excel redesign)        |
| Severity      | Soft warnings — saves and approve remain allowed                           |
| `propertyUse` | Auto-suggest only — warn to set `MIX_PROPERTY`; never auto-overwrite       |
| Floor totals  | Derived as sum of usage rows per `floorPosition` (no new field)            |
| Approach      | Shared evaluator in `packages/validation`, wired into API + minimal QC UI  |
| Hard errors   | Unchanged: duplicate `(floorPosition, usageFactor)`, missing `usageFactor` |

## Non-goals

- Prisma migration / new floor-total field
- Tax calc / Excel export changes
- Registry filter by warnings
- Nested floor→usage tree redesign
- Unique key expansion to include `usageType`
- Persisting warnings on Survey

## Data model (unchanged)

- `Floor` unique on `(surveyId, floorPosition, usageFactor)`.
- Mixed use = multiple rows on the same floor (e.g. Ground Residential 600 + Ground Commercial 400).
- Survey `propertyUse` / `propertyType` remain single scalars.
- Floor total for a position = sum of `areaSqFt` for that `floorPosition`.

## Architecture

```
Floors CRUD ──┐
              ├──► evaluateMixedUseFloorWarnings ──► warnings[] ──► QC warning panel
QC survey GET ┘
```

### Shared module

`packages/validation/src/floor-usage-warnings.ts` exports:

```ts
evaluateMixedUseFloorWarnings(input): FloorUsageWarning[]
```

Each warning: `{ code, severity: "warning", message, floorPosition?, usageFactor? }`.

### Soft warning catalog

| Code                              | When                                                                |
| --------------------------------- | ------------------------------------------------------------------- |
| `MIXED_USE_PROPERTY_USE_MISMATCH` | ≥2 distinct usage factors on survey, `propertyUse` ≠ `MIX_PROPERTY` |
| `FLOOR_AREA_EXCEEDS_PLOT`         | Sum of floor areas > plot (when plot is set)                        |
| `FLOOR_AREA_EXCEEDS_PLINTH`       | Sum > plinth (when plinth is set)                                   |
| `BUILT_UP_MISMATCH`               | Stored `totalBuiltAreaSqFt` ≠ sum (tolerance 0.01 sq ft)            |
| `MISSING_FLOOR_AREA`              | Notable missing `areaSqFt` on usage rows                            |
| `USAGE_FACTOR_MIXED_AMBIGUOUS`    | Row uses `MIXED` while siblings already split usages on that floor  |

Skip area-exceed checks when plot/plinth unset; skip mix mismatch when only one usage factor or no floors.

### API wiring

1. QC survey GET (and correct response for consistency) attach `warnings`.
2. Floors create/update/delete return `warnings` after write + built-up recalculation.
3. Soft warnings never fail the request. Approve/reject unchanged.

### QC UI

- Warning list in Taxation & Floor Details when `warnings.length > 0`.
- Mismatch message tells QC to set Property Use → `MIX_PROPERTY` manually.
- Optional read-only derived per-floor sums; keep flat floor editor.
- Floor mutations already invalidate QC survey query so warnings refresh on refetch.

## Edge cases

| Case                                 | Behavior                            |
| ------------------------------------ | ----------------------------------- |
| No floors                            | No floor-area / mix warnings        |
| Plot or plinth unset                 | Skip corresponding exceed warning   |
| Single usage across floors           | No property-use mismatch            |
| `propertyUse` already `MIX_PROPERTY` | No mismatch warning                 |
| Floating-point drift                 | Compare with tolerance `0.01` sq ft |
| Approve with warnings                | Allowed                             |

## Success criteria

1. Ground Res 600 + Com 400 saves without hard failure.
2. QC review shows soft warnings from the shared evaluator.
3. Duplicate `(floorPosition, usageFactor)` still hard-fails.
4. No Prisma schema migration; tax/Excel/registry unchanged.
5. Unit tests cover the warning catalog.
