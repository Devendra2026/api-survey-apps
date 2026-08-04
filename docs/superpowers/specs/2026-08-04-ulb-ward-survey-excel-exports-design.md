# ULB / Ward Survey Excel Exports

**Date:** 2026-08-04  
**Status:** Approved  
**App:** `api-survey-apps`  
**Approach:** Enhance existing `ExportJob` + BullMQ worker + object-storage signed URL pipeline

## Problem

Ops need Survey Data Excel downloads by ULB/ward, plus a full district dump of all wards. Current exports silently cap at 10 000 rows and build workbooks fully in memory, so large scopes are incomplete and slow/fragile.

## Locked decisions

| Decision          | Choice                                                                |
| ----------------- | --------------------------------------------------------------------- |
| Template          | Survey Data (wide tax-style sheet) only                               |
| Single scope      | One `.xlsx` for selected ULB and/or ward (filters from Reports UI)    |
| District full     | Requires `districtId`; ZIP of one Survey Data file per ward           |
| ZIP layout        | `{ulbCode}/{wardNumber}-{wardName}.xlsx`; skip empty wards            |
| Status/QC filters | Respect Reports UI filters as-is (no forced APPROVED)                 |
| Tenant RBAC       | Unchanged (`buildTenantWhere`)                                        |
| Speed             | Batched DB reads + ExcelJS streaming writer + ZIP to temp then upload |
| Empty ZIP         | Fail job: “No surveys match filters”                                  |
| Soft row guard    | Fail if matching rows exceed ~500 000                                 |
| Sync path         | Small single-file only; district ZIP always async                     |
| Out of scope v1   | Nightly cache, Convex Full as ZIP, job history UI                     |

## Architecture

```
Reports UI → GET /reports/export → ExportJob (QUEUED) → BullMQ exports
  → Worker: survey_data | district_ward_zip
  → Object storage → signed download URL
```

### Modes

1. **`survey_data`** — single Survey Data workbook for current filters (ULB/ward/district/etc.).
2. **`district_ward_zip`** — requires `districtId`; streams one workbook per non-empty ward into a ZIP.

### Performance

- Remove silent `take: 10000` for these async Survey Data paths.
- Query surveys in cursor batches (~500–1000) ordered by `id`.
- Write with `ExcelJS.stream.xlsx.WorkbookWriter` (`row.commit()`).
- Build ZIP on disk (e.g. `archiver`); upload artifact; clean temps in `finally`.
- Client poll timeout extended for ZIP jobs (~15 minutes).

## API / UI

- `reportType=district_ward_zip`: validate `districtId`; reject `sync=true`.
- Job artifact mime `application/zip`; filename `survey-data-district-{code}-wards.zip`.
- Reports page: keep Survey Report → Excel; add **Download all wards (ZIP)** enabled when District is selected.
- Permission: `report:export`.

## Errors

- Missing district on ZIP → 400.
- No matching surveys → job FAILED with clear message.
- Soft max exceeded → FAILED asking to narrow filters.
- Mid-job failure → FAILED; delete partial object if uploaded; clean temps.

## Testing

- Streaming Survey Data column/header parity with buffer renderer.
- Async survey_data not truncated above 10k (batching).
- ZIP paths, empty wards omitted, no-match fails, district required, sync rejected for ZIP.
