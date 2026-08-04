# QC Final + Survey Data Excel Reports

**Date:** 2026-08-04  
**Status:** Approved  
**App:** `api-survey-apps`  
**Approach:** Harden existing `qc_final` and `survey_data` report types

## Problem

QC needs two independent Excel exports with correct business logic: a ward-wise Final QC Report (approved only) and a Survey Data export without tax demand columns for pre-demand verification. Today APPROVED filtering is only in the QC Final renderer, Survey Data still includes blank tax columns, QC Final is not wired in the Reports UI, and filenames are generic.

## Locked decisions

| Decision              | Choice                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Approach              | Harden existing `qc_final` / `survey_data` (no new report-type aliases)                                |
| QC Final scope        | Requires `wardId`; force `qcStatus=APPROVED` in API/worker WHERE                                       |
| QC Final tax cols     | Keep Property/Water/Drainage/Total Annual Demand as **blank placeholders**                             |
| Survey Data tax       | Remove all Tax Demand headers and blank tax columns; keep wide floor/area layout                       |
| Survey Data QC filter | Respect UI filters only — do not force APPROVED                                                        |
| Filenames             | `QC_Final_Report_<WardName>.xlsx`; `Survey_<Ward\|Ulb\|District>.xlsx` (fallback `Survey_Export.xlsx`) |
| UI                    | Reports: QC Final Excel disabled without ward; Survey Report stays `survey_data`                       |
| Download              | Existing API file proxy                                                                                |

## Architecture

```
Reports UI → GET /reports/export (qc_final | survey_data)
  → ExportJob → Worker (filter rules + template)
  → GET /reports/jobs/:id/file
```

## Filtering comments (canonical)

- **qc_final:** Ward-wise approved data only — reject missing ward; force APPROVED. Exclude pending/rejected/draft via QC status.
- **survey_data:** Export all matching filters (no tax demand fields in template). Do not force qcStatus.

## Out of scope

- Computing real tax demand values
- District ZIP packaging changes beyond inheriting the updated Survey Data template
- QC registry Excel button (Reports only)
