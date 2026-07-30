# Tenants & Wards + QC Active Ward Queue

**Date:** 2026-07-30  
**Status:** Approved  
**App:** `api-survey-apps`  
**Approach:** Neighbor API + persisted working context (Approach 1)

## Problem

1. Ward deletion is API-ready behind `settings:manage` but the Tenants & Wards UI has no delete control; product requires Admin-role-only delete with confirmation.
2. Ward select labels diverge across the app (`Ward n · name`, `n — name`, name-only fallbacks).
3. QC Supervisors need a locked Active Ward working context on the review detail page, sequential pending-parcel navigation by `parcelNumber ASC`, and faster registry search.

## Goals

- Admin-only ward delete (role name `ADMIN`) with confirm modal.
- Standardize ward **select** options as `{wardNumber} - {wardName}` (value = `wardId`).
- Detail-first Active Ward queue on `/qc/review/[id]` with Zustand + localStorage persistence.
- Pending-QC-only neighbors (`SUBMITTED` + `qcStatus PENDING`), ordered `parcelNumber ASC`.
- Auto-advance after Approve/Reject; manual Next/Previous always available.
- Debounced registry search (~400ms); composite index `(wardId, parcelNumber)` on surveys.

## Non-goals

- New Parcel table (parcel = `Survey.parcelNumber`).
- Cascade-delete surveys when deleting a ward.
- Client-side full-ward ID lists.
- Status-tab-aware detail queue (registry tabs stay independent).
- Reformatting compact non-select ward pills.

## Locked decisions

| Decision            | Choice                                                        |
| ------------------- | ------------------------------------------------------------- |
| Active Ward surface | Detail-first (`/qc/review/[id]`); registry soft-defaults only |
| Auto-advance        | After Approve or Reject; Next/Prev always available           |
| Queue membership    | Pending QC only                                               |
| Ward delete gate    | `roleName === "ADMIN"` (active tenant role)                   |
| Persistence         | Zustand + localStorage (`activeWardId`, `activeUlbId`)        |

## Architecture

```
Registry (/qc/registry)  --open Review-->  Detail (/qc/review/:id)
                                              |
                                    QCWorkingContext (localStorage)
                                              |
                         GET /qc/queue/neighbors | GET /qc/queue/first
```

### Domain

- Parcel identity for ordering/display: `Survey.parcelNumber` (display padded, e.g. 5 digits).
- Pending filter (same as registry Pending tab): `surveyStatus === SUBMITTED` AND `qcStatus === PENDING`.
- Index: `@@index([wardId, parcelNumber])` on `Survey` → table `surveys`.

### API

- `DELETE /wards/:id` — require Admin role (403 otherwise); tenant-scoped; no cascade.
- `GET /qc/queue/first?wardId=` — first pending survey `{ id, parcelNumber }` or null.
- `GET /qc/queue/neighbors?wardId=&surveyId=` — `{ prevId, nextId, parcelNumber }`.
- Registry `sortBy=parcelNumber` supported; default ASC when ward filter active on web.

### UI

- Shared `formatWardOptionLabel` for all ward selects.
- Tenants & Wards: Delete visible only for Admin; confirm copy: _“Are you sure you want to delete this ward? This action cannot be undone.”_
- Review sticky header: Active Ward select; switch confirms then redirects to first pending parcel.
- Action bar: Previous / Next; after Approve/Reject → next pending or toast + registry.

## Success criteria

1. Only Admin sees/calls ward delete; confirm modal required.
2. All ward select options show `number - name`; value is `wardId`.
3. Active ward survives refresh; switch confirms and jumps to first pending parcel.
4. Detail Next/Prev and post-Approve/Reject advance follow pending queue `parcelNumber ASC`.
5. Registry search is debounced; `(wardId, parcelNumber)` index exists on surveys.
