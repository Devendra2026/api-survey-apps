# QC Registry Field-Scoped Search

**Date:** 2026-08-03  
**Status:** Approved  
**App:** `api-survey-apps`  
**Approach:** Query param `searchField` + one search box with field dropdown

## Problem

QC Review Registry had a single free-text search that OR-matched property ID, owner, parcel, ward, and surveyor. Supervisors need to target owner name, parcel number, or property ID specifically. Search must feel near-instant on large registries.

## Locked decisions

| Decision | Choice                                                                                        |
| -------- | --------------------------------------------------------------------------------------------- |
| UI       | One search input + field dropdown (`All` \| `Owner name` \| `Parcel number` \| `Property ID`) |
| Match    | Case-insensitive substring (`contains` / ILIKE-style)                                         |
| `All`    | OR of owner + parcel + propertyId only                                                        |
| Debounce | 300ms on text; field change re-fetches with current text                                      |
| Cancel   | AbortSignal forwarded from React Query → axios                                                |
| Counts   | Tab badge counts skipped while `search` is non-empty; client keeps prior badges               |
| Indexes  | `pg_trgm` GIN on `propertyId`, `parcelNumber`, `respondentName`, `co_owners.name`             |
| API      | Optional `searchField` on `GET /qc/registry`; `search` max length 100                         |

## Non-goals

- Separate inputs per field
- Exact-match-only mode
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

Empty `search` → no text filter; tab counts computed as usual.  
Non-empty `search` → text filter applied; `counts` returned as `null` (client retains last badges). Geo scope, tabs, pagination unchanged otherwise.

## Frontend

- Dropdown beside search input on QC registry table
- Unified placeholder: `Search by Parcel Number, Property ID, or Owner Name`
- Clear button, inline loading spinner while fetching with search text
- Empty state: `No results found` when search has no matches
- Page state: `searchField` (default `all`) passed into `useQcRegistry` with 300ms-debounced `search`
- `keepPreviousData` + AbortSignal for smooth typing / request cancellation

## Database

SQL migration enables `pg_trgm` and creates GIN trigram indexes for substring ILIKE. Btree indexes also exist on `parcelNumber` and `respondentName`.

## Success criteria

1. Searching with `searchField=owner` does not match ward/surveyor/propertyId-only hits.
2. Parcel search still uses digit padding variants.
3. `All` no longer includes ward number or surveyor name.
4. Unit tests cover each `searchField` value, empty search, mixed-case, and skipped tab counts while searching.
5. Typing cancels in-flight registry requests; debounce is 300ms.
