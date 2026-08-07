# Survey + QC Excel Export Mapping Sync

**Date:** 2026-08-07  
**Status:** Approved (Approach 1 — extend shared `toSurveyBaseRow`)  
**App:** `api-survey-apps`

## Problem

Survey Data and QC Final Excel exports share a base row helper but diverge from the Anand Nagar reference template: duplicate Property No / Survey Id, unpadded parcels, no Unit / Old Property columns, blank fallbacks instead of `N/A` / `0000000000`, comma-joined floor labels instead of abbreviation codes, and export sort by survey id instead of parcel.

## Locked decisions

| Decision                           | Choice                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Scope                              | Nest Report Module + Survey/QC UI parcel display only                         |
| Approach                           | Extend shared `toSurveyBaseRow`; QC Final appends blank tax columns only      |
| House No                           | `houseDoorNo` → `N/A` if blank                                                |
| Old Property Number (House Number) | `propertyIdOld` → `N/A` if blank                                              |
| Floors                             | Abbreviation `B`/`G`/`F1`…`Fn`/`P`; Open Land does not add a letter           |
| Sort                               | Streaming `parcelNumber` → `unitSubNo` → `id` with composite cursor           |
| Out of scope                       | `sdv-monorepo-apps`, Nagar Panchayat / Convex-full exporters, tax computation |

## Column contract (shared base)

1. SN
2. Survey Id — `propertyId` or derived `formatPropertyId`, else `N/A`
3. Owner Name — co-owner → respondent → `N/A`
4. Owner Father Name — `N/A` if blank
5. Mobile No — 10 digits or `0000000000`
6. Ward Name
7. Parcel No — `padParcelNo` (5 digits)
8. Unit Number — `padUnitNo(unitSubNo)` or `N/A`
9. City / Pincode
10. House No / Old Property Number (House Number) / Colony — `N/A` if blank
11. Tax Rate Zone / Property Type / Property Use / Road Type — existing display
12. Floors abbreviation + floor area matrix + plot/plinth/built (unchanged matrix)

**Removed:** duplicate Property No column.

## Floors abbreviation

A floor is active if any Residential or Non-Residential area on that level is `> 0`. Codes concatenate in order (`GF1`, `BGF2`, `GF4`). If no built floor is active → `P`.

## UI

Survey and QC registry tables display parcels via `formatParcelDisplay` / `padParcelNo`. QC continues to persist padded parcels on edit. No DB backfill of historical unpadded values.

## Architecture

```
Reports UI → API filters → ExportWorker.iterateSurveyBundles (parcel/unit/id)
  → toSurveyBaseRow (shared mapping)
    → Survey_*.xlsx | QC_Final_Report_*.xlsx (+ blank tax cols)
```
