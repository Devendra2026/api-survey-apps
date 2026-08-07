# Enterprise Survey / QC Excel Reports — Workflow Column Redesign

**Date:** 2026-08-07  
**Status:** Approved for planning (Approach 1 — incremental reshape)  
**Scope:** Survey Data Report and QC Final Report Excel exports in `@workspace/excel-reports` + export worker

## Problem

Exports already use a single-sheet, header-first enterprise shell (no Dashboard/banner). Column layout still drifts from how Surveyors, QC Engineers, Municipal Officers, Tax Officers, and Auditors review a property:

- Floor usage/area not consistently paired through Fourth Floor
- Plot Area not leading the area block; redundant “No. of Floors”
- Missing GIS Status
- Some labels still slightly off business language (`Address` vs `Property Address`, `Ownership` vs `Ownership Type`)
- Survey must remain tax-free; QC must append QC + Tax + Demand clearly

Sample `.xlsx` files were not present in the repo at design time; analysis used the live mappers in `premium-columns.ts` / `premium-workbook.ts`.

## Goals

- Production-quality, ERP-like sheets: clean, searchable, printable, auditable
- Natural review workflow column order
- Survey = survey capture only; QC = survey + QC + tax + demand
- Soft missing-mandatory highlight only (never block export)
- Keep DB batch streaming; avoid chrome that bloats workbooks

## Non-goals

- Dashboard sheet, charts, logos, municipality headers, title pages, decorative banners
- Merged cells, AutoFilter forced on
- Schema migrations for Category or Rain Water Harvesting
- True ExcelJS stream writer (defer unless memory becomes an issue)
- Changing demand-notice PDFs or tax formula definitions

## Decisions (locked)

| Topic          | Choice                                                            |
| -------------- | ----------------------------------------------------------------- |
| Approach       | Incremental reshape of existing enterprise shell + column mappers |
| Floor layout   | Paired per floor: Usage \| Area through Fourth Floor              |
| Area block     | Plot Area → GF–4F pairs → Total Built-up Area; drop No. of Floors |
| GIS Status     | `Captured` if both lat & lng present, else `Missing`              |
| Category / RWH | Placeholder `—` (no dedicated fields)                             |
| Tax soft-fail  | Placeholders when rates/config missing; do not hard-fail export   |

## Architecture

```text
ExportWorker (batch cursor) → toSurveyPremiumRow / toQcPremiumRow
  → streamEnterpriseWorkbookToFile (single sheet, header row 1)
  → .xlsx
```

- **Survey Data** sheet name: `Survey Data`
- **QC Final** sheet name: `QC Final`
- Chrome: freeze `ySplit: 1` + Survey ID `xSplit: 1`; thin borders; header fill `#2E75B6`; alt rows; missing `#FFC7CE` + note; print titles `1:1`; no AutoFilter
- Soft duplicate Survey ID detection remains log-only in composers/worker

## Survey Data column contract

Business labels only. Mandatory soft-highlight marked `*`.

1. **Survey:** Survey ID*, Survey Number, Survey Date, Survey Status, Surveyor
2. **Owner:** Owner Name*, Father/Husband Name, Mobile Number, Category
3. **Location:** Ward*, Locality, Colony, Property Address, Parcel Number*, Holding Number, Unit Number
4. **Classification:** Property Type*, Property Usage*, Ownership Type, Occupancy, Construction Type, Road Type
5. **Area / floors:** Plot Area* → Ground Floor Usage | Ground Floor Area → First Floor Usage | First Floor Area → Second Floor Usage | Second Floor Area → Third Floor Usage | Third Floor Area → Fourth Floor Usage | Fourth Floor Area → Total Built-up Area
6. **Utilities:** Water Connection, Sewer Connection, Electricity, Toilet, Rain Water Harvesting
7. **GIS:** Latitude, Longitude, GIS Status
8. **Attachments:** Property Photo Count, Owner Photo Count, Document Count

### Field mapping notes

| Column                | Source                                            |
| --------------------- | ------------------------------------------------- |
| Surveyor              | `createdBy.fullName`                              |
| Category              | `—`                                               |
| Property Address      | composite house/locality/colony/city/pin          |
| Holding Number        | `propertyIdOld`                                   |
| Ownership Type        | `ownershipType`                                   |
| Occupancy             | ground floor occupancy / `situation`              |
| Floor pairs           | `floors` by `GROUND_FLOOR` … `FOURTH_FLOOR`       |
| Sewer / Toilet        | both `sanitationType` until distinct fields exist |
| Rain Water Harvesting | `—`                                               |
| GIS Status            | derived from lat/lng presence                     |
| Attachments           | photo-type count heuristics                       |

**Forbidden on Survey:** any tax zone/rate/category, land/building/water/drainage/conservancy taxes, penalty, interest, current/previous/total demand.

## QC Final column contract

Identical Survey columns, then:

**QC:** QC Status, QC Approved By, QC Date (`approvedAt`), QC Remarks

**Tax:** Tax Zone, Tax Category (`—`), Tax Rate (zone map when known), Land Tax (`—`), Building Tax ← `propertyTax`, Water Tax, Drainage Tax, Conservancy Tax (`0`), Other Charges (`0`)

**Demand:** Current Demand ← property + water + drainage, Previous Arrears (`0`), Penalty, Interest (`0`), Total Demand ← tax summary total

Missing published rates: soft placeholders; worker continues export.

## Implementation touch points

| File                                                             | Change                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| `packages/excel-reports/src/premium-columns.ts`                  | Rebuild column lists + mappers per contract               |
| `packages/excel-reports/src/premium-workbook.ts`                 | No chrome changes expected (already enterprise)           |
| `packages/excel-reports/src/survey-data.ts` / `qc-final-wide.ts` | Unchanged API shape; consume new columns                  |
| `apps/worker/.../export-worker.service.ts`                       | No meta chrome; keep soft tax                             |
| `apps/api/src/reports/excel/excel-reports.spec.ts`               | Assert layout, GIS Status, Fourth Floor, no tax on Survey |

## Testing

- Workbook has exactly one sheet (`Survey Data` / `QC Final`)
- Header row 1; first data row 2; freeze `ySplit: 1`; AutoFilter off
- Survey headers exclude all tax/demand names; include Fourth Floor Usage/Area and GIS Status
- Plot Area appears before Ground Floor Usage
- QC sample rates produce Building Tax / Total Demand; missing Owner/Parcel soft-highlighted
- Streaming buffer matches Survey ID cell

## Out of scope follow-ups

- Persist Owner Category and Rain Water Harvesting in schema
- Distinct sewer vs toilet fields
- ExcelJS streaming writer for very large wards
- Charts / Dashboard (explicitly rejected)
