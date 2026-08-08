# Enterprise Survey/QC Excel — Data-Only Attachments Removal

**Date:** 2026-08-08  
**Status:** Approved for planning (Approach 1 — minimal delta)  
**Scope:** Survey Data Report and QC Final Report in `@workspace/excel-reports`

## Problem

Daily-use enterprise exports are largely in place (header-first, no Dashboard/banner, paired floors, GIS Status, Survey tax-free, QC with tax/demand). Attachment **photo/document count** columns are not needed for officer workflows that only require property and tax **data**.

## Goals

- Remove Property Photo Count, Owner Photo Count, and Document Count from Survey and QC exports
- Keep all other approved workflow columns and formatting
- Soft mandatory highlighting and soft tax placeholders unchanged

## Non-goals

- Dashboard, charts, logos, banners, merges, forced AutoFilter
- Schema changes for Category / Rain Water Harvesting
- Changing tax formulas or demand-notice PDFs
- Embedding or exporting photo binaries

## Decisions (locked)

| Topic          | Choice                                                      |
| -------------- | ----------------------------------------------------------- |
| Approach       | Minimal delta on existing enterprise shell + column mappers |
| Floor layout   | Paired: Plot Area → GF–4F Usage\|Area → Total Built-up      |
| Attachments    | **Omit** all photo/document count columns                   |
| GIS Status     | `Captured` if both lat & lng present, else `Missing`        |
| Category / RWH | Placeholder `—`                                             |

## Survey Data column contract

1. Survey: Survey ID*, Survey Number, Survey Date, Survey Status, Surveyor
2. Owner: Owner Name*, Father/Husband Name, Mobile Number, Category
3. Location: Ward*, Locality, Colony, Property Address, Parcel Number*, Holding Number, Unit Number
4. Classification: Property Type*, Property Usage*, Ownership Type, Occupancy, Construction Type, Road Type
5. Area/floors: Plot Area* → paired GF–4F Usage\|Area → Total Built-up Area
6. Utilities: Water Connection, Sewer Connection, Electricity, Toilet, Rain Water Harvesting
7. GIS: Latitude, Longitude, GIS Status

**Forbidden on Survey:** any tax/demand columns.

## QC Final

Identical Survey columns, then:

- QC: QC Status, QC Approved By, QC Date, QC Remarks
- Tax: Tax Zone, Tax Category, Tax Rate, Land Tax, Building Tax, Water Tax, Drainage Tax, Conservancy Tax, Other Charges
- Demand: Current Demand, Previous Arrears, Penalty, Interest, Total Demand

Soft tax fill unchanged (placeholders when rates missing).

## Implementation

| File                                               | Change                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/excel-reports/src/premium-columns.ts`    | Drop attachment headers + row values; remove unused `photoCounts`     |
| `apps/api/src/reports/excel/excel-reports.spec.ts` | Assert attachment headers absent; keep existing layout/tax assertions |

## Testing

- Single sheet; header row 1; no AutoFilter
- Survey headers exclude tax and all photo/document count labels
- QC still has Building Tax / Total Demand for sample rates
- Soft red on missing Owner/Parcel

## Out of scope follow-ups

- Persist Category / Rain Water Harvesting
- Distinct sewer vs toilet fields
- True XLSX stream writer for very large wards
