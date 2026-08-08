# Premium Multi-Sheet Excel Reports — Implementation Plan

> **For agentic workers:** Implement task-by-task after user approves this plan. Do not edit the Cursor plan file.

**Goal:** Production-ready Survey Data and QC Final ward-wise Excel downloads with Dashboard + data sheets, premium chrome, soft validation, and QC tax/demand columns.

**Architecture:** Extend `@workspace/excel-reports` with a premium multi-sheet streaming writer; Survey and QC composers; worker passes municipality/ward/generatedBy metadata; soft highlight replaces hard-fail for these reports.

**Tech stack:** ExcelJS stream writer, `@workspace/validation` tax helpers, Nest export worker.

## Tasks

### 1. Design spec

- [x] Written: `docs/superpowers/specs/2026-08-07-premium-excel-reports-design.md`

### 2. Premium workbook shell

- [ ] Add `packages/excel-reports/src/premium-workbook.ts` (banner, freeze, print, alt rows, soft highlight, no AutoFilter)
- [ ] Optimize styles for large exports

### 3. Survey workbook

- [ ] Section A–H column contract + mapper
- [ ] `Dashboard` + `Survey Data` sheets; no tax columns
- [ ] Wire `survey-data.ts` streaming entry points

### 4. QC Final workbook

- [ ] Survey columns + QC + full tax/demand headers
- [ ] Map backend tax summary; placeholders for unsupported fields
- [ ] Soft-fail when rates missing (export with `—`/`0`, do not throw)

### 5. Dashboard + worker

- [ ] O(1) aggregators during stream
- [ ] Pass ulb/ward/generatedBy/exportedAt into exporters
- [ ] Soft validation only; log duplicate Survey Ids

### 6. Tests

- [ ] Two sheets per workbook; Survey has no tax headers
- [ ] QC has Total Demand / Building Tax from fixture
- [ ] Missing mandatory → red + comment; file still builds
- [ ] autoFilter absent; freeze panes set

## Non-goals

Charts, AutoFilter default on, arrears engine, photo embeds, filename changes.
