# QC Final + Survey Data Excel Reports

**Date:** 2026-08-04  
**Status:** Approved (Approach 1 — independent pipelines)  
**App:** `api-survey-apps`

## Problem

QC Final and Survey Data were sharing mixed templates and filter rules. Each report needs its own query filters, sheet layout, filename, and validation.

## Locked decisions

| Decision             | Choice                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Approach             | Two independent template modules + two worker pipelines                                                  |
| QC Final scope       | Require `wardId`; force `qcStatus=APPROVED`                                                              |
| QC Final template    | Wide 64-col `survey.xlsx` layout; tax headers present; **tax cells blank** (rates filled later in panel) |
| Survey Data scope    | Require `wardId`; **strip/ignore** `qcStatus` (export all statuses)                                      |
| Survey Data template | 40-col verification layout (`Survey_Ward-1_Etah.xlsx`); no tax demand columns                            |
| Filenames            | `QC_Final_Report_<Ward>_<District>.xlsx`; `Survey_<Ward>_<District>.xlsx`                                |
| UI                   | Both Excel buttons disabled without ward; ZIP remains district-gated                                     |
| Download             | Existing API file proxy                                                                                  |

## Architecture

```
Reports UI (ward required)
  → API applyReportFilterRules
  → ExportJob → Worker
      qc_final  → WHERE ward+APPROVED → qc-final-wide (64col) → QC_Final_Report_<Ward>_<District>.xlsx
      survey_data → WHERE ward (no QC) → survey-data (40col) → Survey_<Ward>_<District>.xlsx
  → GET /reports/jobs/:id/file
```

## Filtering (canonical)

- **qc_final:** Ward-wise approved data only — reject missing ward; force APPROVED.
- **survey_data:** Ward-wise all QC statuses — reject missing ward; never apply qcStatus.
- Both: assert exported data row count === DB count for the query.

## Out of scope

- Computing real tax demand values
- District ZIP packaging changes beyond inheriting the no-tax Survey Data template
- QC registry Excel button
