# Excel import photo display (Survey View + QC)

**Date:** 2026-07-24  
**Status:** Approved for planning  
**Problem:** Field-captured surveys show photos; Excel-imported surveys with public HTTPS Photo URLs do not load properly in Survey View or QC Review when opened by survey id.

## Context

Excel import creates `Photo` rows with `sourceUrl` set to the sheet’s HTTPS URL, `url = sourceUrl`, `objectKey = null`, and `importStatus = PENDING`. A background image-migration job is supposed to download each URL into object storage and set `objectKey`. Survey View and QC detail then call `refreshSurveyPhotoUrls` to mint signed download URLs.

Field uploads already store objects and signed URLs, so they work. Imported photos fail when migration is stuck, when detail returns a non-http `url` (raw storage key after migrate), or when there is no fallback to `sourceUrl`.

## Goals

- After Excel import with public HTTPS Photo URLs, photos appear in Survey View and QC Review (same UX as field-captured surveys once migrated).
- Never serve a bare `uploads/...` object key as an `<img src>`.
- Prefer durable storage (`objectKey` + signed URL); fall back to HTTPS `sourceUrl` while PENDING/FAILED when the link is still usable.
- Surface migrating / failed state lightly in the UI.

## Non-goals

- Embedded images or local file paths inside Excel.
- Changing survey UUID / propertyId resolution for open-by-id.
- Replacing the async migration architecture with fully synchronous download during import.

## Architecture

```text
Excel Photo URL (https)
  → Import creates Photo (sourceUrl, PENDING, objectKey=null)
  → enqueueImageMigrationBulk (API sync import + async import worker)
  → Worker downloads → putObject → objectKey + SUCCEEDED
  → getSurveyDetails / QC getSurveyDetail
  → refreshSurveyPhotoUrls → usable http(s) URL → UI <img>
```

Chosen approach: harden the existing migration + detail URL pipeline (not sync-in-import, not sourceUrl-only forever).

## Components

### 1. `refreshSurveyPhotoUrls` (API)

File: `apps/api/src/surveys/survey-photo-urls.ts`  
Used by: `surveys.service` detail + `qc.service` detail.

Per photo:

1. If `objectKey` is set → return fresh presigned URL.
2. Else if `sourceUrl` or `url` is `http://` / `https://` → return that URL for display.
3. Never return a path that looks like a storage key (`uploads/...`) as the client `url`.
4. Pass through / add `importStatus` on the photo DTO when available so the UI can label state.

If storage is not configured: still apply (2)/(3) so PENDING imports with public HTTPS links can render.

### 2. Import enqueue (unchanged contract)

Files: `apps/api/src/imports/imports.service.ts`, `apps/worker/src/imports/import-worker.service.ts`, `apps/worker/src/imports/imports.processor.ts`.

- Continue creating PENDING photos from Photos sheet / inline Photos column (`Photo URL` HTTPS).
- Continue calling `enqueueImageMigrationBulk` after successful survey create/update.
- Excel format remains: public HTTPS links (Property ID + Slot + Photo URL).

### 3. Image migration worker

File: `apps/worker/src/images/image-migration.service.ts`.

- On success: set `objectKey`, `SUCCEEDED`; stored `url` may remain the key (detail refresh must not expose it raw).
- On hard failure: `FAILED`; keep `sourceUrl` for fallback.
- Add a requeue helper for PENDING/FAILED photos for given survey IDs (for recovery without re-import), invokable from import completion path and/or a small API/detail-triggered enqueue of stuck photos.

### 4. UI (Survey View + QC)

Files: `apps/web/components/surveys/survey-view-content.tsx`, `apps/web/components/qc/qc-review-sections.tsx` (and related photo tiles).

- Continue using API-provided `photo.url`.
- If `importStatus === PENDING` and image not yet loaded: show “Photo migrating…”.
- If failed / no usable URL: keep “Image unavailable”.

## Error handling

| Case                         | Behavior                                                 |
| ---------------------------- | -------------------------------------------------------- |
| Non-http sourceUrl           | Mark FAILED; tile unavailable                            |
| Download fails after retries | FAILED; keep sourceUrl for fallback                      |
| Presign failure              | Warn; fall back to https sourceUrl if present            |
| Worker down                  | Stay PENDING; UI “migrating” + sourceUrl if public https |
| No photos on survey          | Empty section; no error                                  |

## Verification

1. Import workbook with public Photo URLs → open survey by id in Survey View and QC → Front/Side visible (sourceUrl and/or after migration).
2. After worker migrates → images still load via signed URLs.
3. Survey with no photos → empty, no crash.
4. One bad URL among good ones → only that tile fails.

## Out of scope

- Embedded Excel binary images.
- Local filesystem paths as Photo URL.
- Survey id UUID migration changes (not the root cause for missing photos).
