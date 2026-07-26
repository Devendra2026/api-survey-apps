# Tax Rates Panel — Clarity-First UI

**Date:** 2026-07-27  
**Status:** Approved for implementation  
**App:** `api-survey-apps` Master Data Hub → Tax Rates  
**Prior work:** Ward-wise panel in `features/master-data/tax/*` (screenshot parity v1)

## Problem

The Tax Rates workflow matches product needs (ULB scope → ward list → per-ward matrix), but the UI is noisy: SAVED chips on every ward, weak separation between ULB chrome and the active ward editor, and preview/matrix hierarchy that doesn’t scan as cleanly as the reference screenshots.

## Goals

- Keep **exact** product behavior from screenshots (district/ULB/year, ward list, per-ward rates, preview cards, matrix, tax %, Copy/Default/Reset/Save/Publish).
- Improve **clarity**: quieter list, clear ULB vs ward layers, editor as the focus.
- Polish visuals within existing Hub tokens (Inter, indigo Hub, emerald tax CTAs).

## Non-goals

- Formula Builder in default view
- New Nest bulk APIs
- Inheritance/override cell badges (Approach 3)
- Live Figma canvas
- Changing per-ward data model

## Locked decisions

| Decision | Choice                                             |
| -------- | -------------------------------------------------- |
| Priority | **B — Clarity first**                              |
| Approach | **1 — Quiet list + loud editor**                   |
| Data     | Unchanged `useTaxConfig(wardId, assessmentYearId)` |

## Information hierarchy

1. **Scope** — District · Municipality · Assessment year
2. **ULB bar** — Name, counts, Published, Reset ULB, Save All, overflow (Publish/History/Rollback)
3. **Split** — Quiet ward list | Ward editor (sticky header + matrix hero)

Inactive wards: name only (optional muted ·). Status chip only on **active** ward (Draft / Saved / Published). Optional “Unsaved” when dirty cells pending.

## Visual layout

- Slim banner (optional, non-competing)
- Scope card
- ULB toolbar (never looks like ward edit target)
- Sidebar ~260–280px; emerald selected row
- Editor: EDITING Ward XX — Name · ULB Default · System Default · Copy to All · Save Ward
- Filters + “Ward XX preview · matches demand notice lookup”
- Four preview cards · navy-header matrix · formula note · tax % card
- Stack below `lg`; matrix `overflow-x-auto`

## Actions (unchanged semantics)

Save Ward, Save All (current ward + toast), Copy to All, ULB Default, System Default, Reset ULB, Publish/History/Rollback — existing client + Nest cell APIs.

## Code touchpoints

| File                       | Change                                                  |
| -------------------------- | ------------------------------------------------------- |
| `ward-rates-sidebar.tsx`   | Quiet chips                                             |
| `ulb-rates-toolbar.tsx`    | Clearer ULB-only chrome                                 |
| `ward-rate-editor.tsx`     | Sticky header, helper line, airier layout, formula note |
| `preview-metric-row.tsx`   | Calmer cards                                            |
| `tax-percentages-card.tsx` | Screenshot copy                                         |
| `TaxMatrix.tsx`            | ₹ inputs if straightforward                             |
| `tax-rates-banner.tsx`     | Slimmer                                                 |

## Testing

- Switch wards → editor remounts; rates differ
- Active chip only; inactive quiet
- Save / Copy / Default / Reset / Publish still work
- Responsive stack ~768px

## Spec self-review

- No TBDs; Approach 1 explicit; no Nest changes; scope limited to UI clarity polish.
