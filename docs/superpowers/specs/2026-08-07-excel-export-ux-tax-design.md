# Production Excel Export UX + QC Tax

**Date:** 2026-08-07  
**Status:** Approved (Approach 1 — shared flat-header shell)  
**App:** `api-survey-apps`

## Problem

Survey Data and QC Final Excel reports used a 4-row merged header without AutoFilter on a single clean header, blank QC tax cells, and limited capture/QC metadata. Municipal officers need filterable, frozen, styled workbooks with Survey capture-only exports and QC Final Total Demand computed from backend tax logic.

## Locked decisions

| Decision    | Choice                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| Layout      | Single flat header (optional title above); no multi-row merges                                       |
| Survey Data | Full survey capture only — no tax columns                                                            |
| QC Final    | Capture core + QC metadata + computed Property/Water/Drainage/Penalty + Total Demand                 |
| Tax detail  | Summary columns only (not RCC/TEEN/KATCHA matrix)                                                    |
| Validation  | Hard-fail on blank/duplicate Survey Id; QC also fails blank Owner/Parcel; fail if ward rates missing |
| Scale       | Streaming ExcelJS writer + parcel/unit/id cursor                                                     |

## Architecture

```
ExportWorker → toSurveyCaptureRow / toQcFinalRow (+ tax cache)
  → workbook-shell (filter, freeze, styles, borders)
    → Survey_*.xlsx | QC_Final_Report_*.xlsx
```

## Non-goals

- Full demand matrix in Excel
- Soft-fail Validation sheet
- `sdv-monorepo-apps` client exporter
- Filename changes
