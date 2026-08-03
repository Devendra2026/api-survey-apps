# QC Registry Field-Scoped Search

**Date:** 2026-08-03  
**Status:** Approved  
**App:** `api-survey-apps`  
**Approach:** Query param `searchField` + one search box with field dropdown

## Problem

QC Review Registry had a single free-text search that OR-matched property ID, owner, parcel, ward, and surveyor. Supervisors need to target owner name, parcel number, or property ID specifically.

## Locked decisions

| Decision | Choice                                                                                        |
| -------- | --------------------------------------------------------------------------------------------- |
| UI       | One search input + field dropdown (`All` \| `Owner name` \| `Parcel number` \| `Property ID`) |
| Match    | Case-insensitive substring (`contains` / ILIKE-style)                                         |
| `All`    | OR of owner + parcel + propertyId only                                                        |
| Debounce | ~400ms on text; field change re-fetches with current text                                     |
| API      | Optional `searchField` on `GET /qc/registry`                                                  |

## Non-goals

- Separate inputs per field
- Exact-match-only mode
- pg_trgm / full-text indexes
- Mobile / ward / surveyor search
- Fixing `parcelShared` tab stub

## API

`searchField` enum: `all` | `owner` | `parcel` | `propertyId` (default / invalid → `all`).

When `search` is set:

| Field        | Matches                                          |
| ------------ | ------------------------------------------------ |
| `propertyId` | `propertyId` contains                            |
| `parcel`     | `parcelNumber` contains + `parcelNumberVariants` |
| `owner`      | `respondentName` + `coOwners.some.name` contains |
| `all`        | OR of the three above                            |

Empty `search` → no text filter. Geo scope, tabs, pagination unchanged; tab counts still use the same base where (including search).

## Frontend

- Dropdown beside search input on QC registry table
- Placeholder updates by selected field
- Page state: `searchField` (default `all`) passed into `useQcRegistry` with debounced `search`

## Success criteria

1. Searching with `searchField=owner` does not match ward/surveyor/propertyId-only hits.
2. Parcel search still uses digit padding variants.
3. `All` no longer includes ward number or surveyor name.
4. Unit tests cover each `searchField` value.
