# Enterprise Survey/QC Excel Workflow Columns — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Align Survey Data and QC Final Excel columns with the approved workflow design (paired floors through Fourth, GIS Status, Plot-first area block, business labels).

**Architecture:** Incremental reshape of `premium-columns.ts` mappers; keep existing `streamEnterpriseWorkbookToFile` shell. Survey remains tax-free; QC appends QC/Tax/Demand.

**Tech Stack:** ExcelJS, `@workspace/excel-reports`, Jest

## Global Constraints

- No Dashboard/banner/merges/AutoFilter
- Soft mandatory highlight only
- Category and Rain Water Harvesting = `—`
- GIS Status = `Captured` | `Missing` from lat/lng presence

---

### Task 1: Column contract + mappers

**Files:** `packages/excel-reports/src/premium-columns.ts`

- [ ] Rebuild `SURVEY_PREMIUM_COLUMNS` / `toSurveyPremiumRow` per design
- [ ] Rebuild QC extras (`QC Date` label); keep tax soft fill
- [ ] Drop `No. of Floors` / `computeFloorsAbbreviation` usage
- [ ] Add Fourth Floor pair + `gisStatus()` helper

### Task 2: Tests

**Files:** `apps/api/src/reports/excel/excel-reports.spec.ts`

- [ ] Assert Property Address, Ownership Type, Plot before GF Usage, Fourth Floor, GIS Status
- [ ] QC uses `QC Date`; tax values + soft highlight still pass

### Task 3: Verify

- [ ] `pnpm --filter @workspace/excel-reports build`
- [ ] Run `excel-reports.spec.ts`
- [ ] Worker typecheck
