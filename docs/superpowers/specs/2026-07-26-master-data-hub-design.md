# Master Data Hub (api-survey-apps)

**Date:** 2026-07-26  
**Status:** Approved for implementation  
**Target:** `api-survey-apps` Administration → Master Data

## Problem

Reference Data, Geographic Hierarchy, and Tax Engine live on separate `/configuration/*` routes. Admins expect a single Master Data Hub (as in the Survey App monorepo screenshots) with three tabs, clear metrics, and low cognitive load.

## Goals

- Unified hub at `/master-data` with tabs: Reference Data → Tenants & Wards → Tax Rates (`?tab=` deep links).
- Screenshot-parity chrome: hero, context-aware metrics, pill tabs, indigo/emerald accents.
- Reuse Nest APIs and existing configuration components (tables, drawers, accordion, tax matrix).
- Redirect old reference / geography / tax-engine routes into hub tabs.
- Keep Demand Rules and Settings outside the hub.

## Non-goals

- Demand Rules / Settings redesign.
- Formula Builder in the default Tax Rates view.
- Porting Convex backends or monorepo GlassCard verbatim.
- Nest schema changes (compose existing endpoints).

## Locked decisions

| Decision  | Choice                                                                                  |
| --------- | --------------------------------------------------------------------------------------- |
| App       | `api-survey-apps`                                                                       |
| Approach  | Hub shell + tab adapters                                                                |
| Routing   | `/master-data?tab=reference\|tenants\|tax-rates`; redirects from old three routes       |
| Tax Rates | Screenshot layout; publish/history/rollback secondary; no Formula Builder in default UI |

## Information architecture

```
Admin → Master Data → /master-data
  ├── ?tab=reference   Reference Data
  ├── ?tab=tenants     Tenants & Wards (Geographic Hierarchy)
  └── ?tab=tax-rates   Tax Rates

/configuration/reference → redirect ?tab=reference
/configuration/geography → redirect ?tab=tenants
/configuration/tax-engine → redirect ?tab=tax-rates
/configuration/reference/[category] → ?tab=reference&category=CODE

Demand Rules / Settings → remain under /configuration/*
```

Permissions unchanged: `settings:view` (open), `settings:manage` (edit), `settings:publish` (publish).

## Page chrome

1. **Hero** — CONFIGURATION eyebrow · Master Data Hub · subtitle · Database icon.
2. **Metrics** — 4 cards; content switches with active tab (Categories / Live / Districts / ULBs vs Districts / ULBs / Wards / Categories).
3. **Configuration Registry** — card with pill tabs (Reference indigo; Tenants indigo + count badge; Tax Rates emerald active).

## Tab 1 — Reference Data

- Horizontal category chips (Assessment Year default or first category / `?category=`).
- Header: title, description, `N options · M active`, search, **+ Add option**.
- Table via `ReferenceTable`; create/edit via `ReferenceDrawer`.
- Footer note: changes sync live to open survey forms.

## Tab 2 — Tenants & Wards

- Header: Geographic Hierarchy · counts · **+ Add district** (or Create State when empty) · search.
- Accordion: State → District → ULB → wards (existing `GeographyAccordion` + drawers).
- Progressive disclosure; wards from tree / on expand.

## Tab 3 — Tax Rates

- Info banner + District / Municipality / Assessment Year selectors.
- After ULB: header with ward counts, status chip, Save, secondary Publish / History / Rollback.
- Split: searchable ward list (SAVED/PUBLISHED chips) · matrix + live preview metrics + tax % card.
- Reuse `TaxMatrix`, preview helpers, publish dialogs; omit Formula Builder from default view.

## Accessibility & responsive

- Real Tabs / keyboard focus rings; status text chips (not color-only).
- Matrix cells labeled; `prefers-reduced-motion` respected where motion is used.
- Desktop-first; stack ward list above editor below `lg`; metrics 2×2 on small screens.

## Component map

```
features/master-data/
  master-data-hub.tsx
  master-data-hero.tsx
  master-data-metrics.tsx
  master-data-registry.tsx
  panels/reference-data-panel.tsx
  panels/tenants-wards-panel.tsx
  panels/tax-rates-panel.tsx
  lib/tab-params.ts
  lib/geo-stats.ts
```

## Testing

- Open `/master-data`; switch tabs via UI and `?tab=`.
- Confirm redirects from old configuration routes.
- CRUD one reference entry; expand geography; edit/save one ward rate; open publish dialog.
- Smoke responsive at ~1024px and ~768px.
