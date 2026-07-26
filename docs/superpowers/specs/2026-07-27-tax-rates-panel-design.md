# Tax Rates Panel — Screenshot Parity (ULB + Ward-wise)

**Date:** 2026-07-27  
**Status:** Approved for implementation  
**App:** `api-survey-apps` Master Data Hub → Tax Rates tab

## Goals

- Match Tax Rates screenshots: banner, ULB scope, emerald ward sidebar, per-ward editor.
- Each ward has an independent rate matrix (`useTaxConfig(wardId, assessmentYearId)`).
- Client-side Copy / ULB Default / System Default / Reset ULB using existing Nest cell APIs.
- No live Figma file; no Nest schema changes.

## Interaction

District → ULB → Assessment year → ward list → **WardRateEditor** (`key={wardId}`) with that ward’s matrix, preview, and status only.

## Layout

1. Emerald info banner
2. Scope selects (District, Municipality, Year)
3. ULB toolbar (counts, status, Reset ULB, Save All, overflow Publish/History/Rollback)
4. Split: WardRatesSidebar | WardRateEditor (filters, 4 preview metrics, navy matrix header, tax %)

## Actions

| Action                       | Behavior                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| Save Ward                    | Flush pending cells for current ward                           |
| Save All Wards               | Same flush + toast that other wards need per-ward save         |
| Copy to All Wards            | Confirm → upsert current cell map onto every other ward in ULB |
| ULB Default                  | Copy cells from another ward in ULB that has rates             |
| System Default               | Zero all cells on current ward                                 |
| Reset ULB                    | Confirm → zero cells for all wards in ULB                      |
| Publish / History / Rollback | Existing dialogs                                               |

## Components

`features/master-data/tax/*` — panel compose + banner, scope, toolbar, sidebar, editor, preview row, tax % card. Re-export from `panels/tax-rates-panel.tsx`.

## Out of scope

Formula Builder default UI, new bulk Nest APIs, Demand Rules/Settings, Figma canvas.
