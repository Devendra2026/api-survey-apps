# Tax Rates Clarity-First UI — Implementation Plan

**Date:** 2026-07-27  
**Spec:** [2026-07-27-tax-rates-clarity-ui-design.md](../specs/2026-07-27-tax-rates-clarity-ui-design.md)

## Locked decisions

- Clarity first: quiet ward list + loud editor
- Exact screenshot features; no Nest API changes
- Polish existing `features/master-data/tax/*`

## Tasks

1. **Quiet sidebar** — Inactive wards: no SAVED badge; chip only on active; optional Unsaved when dirty
2. **ULB chrome** — Stronger ULB-only toolbar copy; slim banner
3. **Editor clarity** — Sticky EDITING header; preview helper line; formula note under matrix; calmer metrics + tax %
4. **Matrix** — ₹ prefix on inputs if simple
5. **Verify** — ESLint; ward switch / save / responsive smoke

## Files

- `ward-rates-sidebar.tsx`, `ulb-rates-toolbar.tsx`, `ward-rate-editor.tsx`
- `preview-metric-row.tsx`, `tax-percentages-card.tsx`, `tax-rates-banner.tsx`
- `tax-rates-panel.tsx` (chip + dirty wiring)
- `TaxMatrix.tsx` (optional ₹)

## Out of scope

Formula Builder UI, bulk Nest APIs, inheritance badges, Figma.
