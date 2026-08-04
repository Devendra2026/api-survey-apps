# ULB / Ward Survey Excel Exports Implementation Plan

> **For agentic workers:** Follow task checkboxes; prefer executing against the approved design spec.

**Goal:** Complete, fast Survey Data Excel downloads for ULB/ward scope plus district ZIP of per-ward workbooks.

**Architecture:** Extend existing `ExportJob` → BullMQ worker → object storage → signed URL. Stream Survey Data with ExcelJS `WorkbookWriter`; build district ZIPs with `archiver`.

**Tech Stack:** NestJS API/worker, ExcelJS, archiver, Prisma, Next.js Reports UI

## Global Constraints

- Template: Survey Data only
- ZIP requires `districtId`; empty match fails the job
- Soft max ~500k rows (`EXPORT_MAX_ROWS`)
- No silent 10k truncation on async `survey_data` / `district_ward_zip`

## Tasks (implemented)

- [x] Design spec committed
- [x] `district_ward_zip` report type in jobs + API
- [x] Streaming Survey Data writer in `@workspace/excel-reports`
- [x] Worker batched `survey_data` + district ward ZIP
- [x] Reports UI ZIP button + long poll
- [x] Parity / validation / batching policy tests
