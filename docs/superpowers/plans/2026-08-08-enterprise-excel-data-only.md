# Data-Only Excel Export (Drop Photo Counts) — Implementation Plan

> **For agentic workers:** Implement task-by-task.

**Goal:** Remove Property Photo Count, Owner Photo Count, and Document Count from Survey Data and QC Final Excel exports.

**Architecture:** Minimal delta on `premium-columns.ts`; enterprise workbook shell unchanged.

**Tech Stack:** `@workspace/excel-reports`, Jest

## Global Constraints

- No attachment/photo count columns
- Keep paired floors, GIS Status, soft tax, soft mandatory highlight

---

### Task 1: Failing test

- [ ] Update `excel-reports.spec.ts` to assert photo/document count headers are **absent**

### Task 2: Remove columns + mapper values

- [ ] Edit `premium-columns.ts`: drop 3 headers, drop photo values, remove `photoCounts`

### Task 3: Verify

- [ ] Build excel-reports; run excel-reports.spec.ts
