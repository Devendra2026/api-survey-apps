# Floor Survey Rules

**Date:** 2026-08-04  
**Status:** Approved  
**App:** `api-survey-apps`  
**Approach:** Shared rule-pack in `@workspace/validation` + API hard checks + QC UI + backfill

## Problem

Property surveys need clear floor rules: stack Ground through Sixth at (or near) full plot size, correct built-up from floor sums, hide built-up for open plots, and stop false plinth warnings that compare total multi-story area to a single-floor plinth.

## Locked decisions

| Decision                                | Choice                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Multi-story stacking                    | Allowed; hard-check **per `floorPosition` footprint ≤ plot** only                                                        |
| Survey-wide FAR hard fail               | **Removed**                                                                                                              |
| Plinth                                  | Soft warning **per floorPosition only** (never sum-of-all-stories > plinth)                                              |
| Unusually high total                    | Soft `FLOOR_AREA_UNUSUALLY_HIGH` when countable total > plot × 3                                                         |
| Property Use mix                        | Soft-only: warn if floors mix usages and use ≠ `MIX_PROPERTY`; never auto-change                                         |
| Open land (`propertyUse === OPEN_LAND`) | Built-up UI **N/A**; floor editor disabled; store built-up **0**; block floor CRUD; do not silent-delete existing floors |
| Floor enums                             | Add `FIFTH_FLOOR`, `SIXTH_FLOOR`; migrate `FIFTH_FLOOR_PLUS` → `FIFTH_FLOOR`; drop `FIFTH_FLOOR_PLUS`                    |
| Built-up                                | Live UI sum + recalculate on CRUD + one-time backfill; exclude `OPEN_LAND` position/usage from sum                       |

## Rules matrix

| Rule                                   | Hard fail                                 | Soft warning                  | Display                                 |
| -------------------------------------- | ----------------------------------------- | ----------------------------- | --------------------------------------- |
| Per `floorPosition` footprint ≤ plot   | Yes (if plot set)                         | —                             | —                                       |
| Per `floorPosition` footprint ≤ plinth | No                                        | Yes (if plinth set)           | —                                       |
| Survey-wide sum vs plot × FAR          | Removed                                   | —                             | Built-up = sum of countable floor areas |
| Total > plot × 3                       | No                                        | `FLOOR_AREA_UNUSUALLY_HIGH`   | —                                       |
| Mixed usage rows on same floor         | Allowed                                   | Mix Property Use mismatch     | Derived per-floor totals                |
| `propertyUse === OPEN_LAND`            | Block floor create/update                 | Existing floors until cleared | Built-up N/A; editor disabled           |
| `OPEN_LAND` floor position/usage       | Excluded from footprint/plot and built-up | —                             | Not counted in built-up                 |

**Example:** 750 plot, Ground…Sixth each 750 → built-up **5250**, no hard block.

## Data model

`FloorPosition`: `BASEMENT`, `GROUND_FLOOR` … `FOURTH_FLOOR`, `FIFTH_FLOOR`, `SIXTH_FLOOR`, `OPEN_LAND`.

Unique constraint unchanged: `(surveyId, floorPosition, usageFactor)`.

`survey.totalBuiltAreaSqFt` / `SqMeter` = sum of countable floor row areas (exclude `OPEN_LAND` position or usage). When Property Use is open land → both `0`.

## Architecture

```
QC Floor Editor ──► Floors API ──► @workspace/validation
                         │              ├── per-floor plot hard check
                         │              └── soft warnings
                         └── recalculateAreas ──► survey.totalBuiltArea*
QC also shows live sum for display (open land → N/A)
```

## API / UI

- `assertAreasWithinPlot`: per-position ≤ plot only.
- Open-land surveys: reject floor create/update; `recalculateAreas` → 0.
- QC: floor select through Sixth; live built-up; open land disables editor and shows N/A.

## Backfill

After enum remap: recompute `totalBuiltArea*` for all surveys from floor rows (open-land use → 0).

## Non-goals

- Auto-setting Property Use from floors
- Property-id letter algorithm changes beyond existing mapping
- Demand-notice tax formula redesign (beyond correct built-up inputs)

## Testing

- Validation: stacking G–6th at full plot allowed; per-floor > plot fails; plinth soft only per position; open-land built-up sum 0
- Repository: FAR hard-fail gone; open-land rejects floors; recalculate excludes OPEN_LAND rows
- QC: open-land N/A + disabled editor; live sum after save
