# District & ULB Code Assignment

**Date:** 2026-07-26  
**Status:** Approved for implementation

## Problem

Geographic Hierarchy shows district codes in the admin UI (e.g. Baghpat · `BAG`), but `District` has no `code` column. ULB codes already exist and are assigned manually/via import. Ward numbering is unchanged.

## Goals

- Add required **District code**: exactly 3 uppercase A–Z letters, unique per state.
- Keep **ULB code** as today (required, globally unique, manual/import).
- Show District and ULB codes in hierarchy explorer and details.
- Align seeds, geo-catalog import, and ETL district-create paths so no district is inserted without a code.

## Non-goals

- Ward format changes (`W01`, zero-padding in master storage).
- New geo-catalog upload UI (API import remains the bulk path).
- Auto-generating ULB codes.

## Data model

`District`:

- Add `code String` (required after migration).
- Add `@@unique([stateId, code])`.
- Keep `@@unique([stateId, name])`.

**Migration:** add nullable → backfill → set required + unique.  
**Backfill:** strip non-letters from name, take first 3 uppercase; on collision within state, bump last letter / deterministic suffix until unique. Admins may edit placeholders later.

## API

- `CreateDistrictDto` / `UpdateDistrictDto`: required `code`; validate format; normalize to uppercase in service.
- Duplicate → clear message: `District code already exists in this state`.
- Geography tree and district list/get responses include `code`.
- ULB DTOs unchanged.

## UI

- District create/edit drawer: required Code (mono), hint `3 letters, e.g. BAG`, client `/^[A-Z]{3}$/`.
- Hierarchy: district row shows code beside name; ULB code remains visible; details panel district subtitle = code.

## Import / seeds / ETL

- Geo-catalog import accepts `District Code` / `DistrictCode` / `districtCode`.
  - If present: normalize + validate.
  - If missing: derive placeholder from district name.
  - Invalid format or conflict within state → row error.
- Seeds and any ETL path that creates districts must supply a 3-letter code.

## Errors & testing

- Format and unique-per-state validation.
- Tests: DTO, uniqueness, import with/without District Code, backfill collision handling.
- Smoke: create/edit district with code; tree shows District + ULB codes.

## Out of scope

- Ward numbering UX/schema changes.
- Geo-catalog upload UI.
- ULB auto-generation.
