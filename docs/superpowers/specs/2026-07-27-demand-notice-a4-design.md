# Demand Notice A4 — Design Spec

**Date:** 2026-07-27  
**Status:** Approved for implementation  
**App:** `api-survey-apps`

## Goals

1. Show the official bilingual Property Tax Demand Notice design on the Report Builder Demand Notice Panel.
2. Print one notice on A4 via browser print (same design).
3. Download a ward-wise bundle of all QC-APPROVED notices as one PDF (identical A4 layout).
4. Individual print = one copy per notice.

## Decisions

| Decision               | Choice                                                        |
| ---------------------- | ------------------------------------------------------------- |
| Eligibility            | `qcStatus === APPROVED` only                                  |
| Single print           | Browser `window.print()` on React A4 document                 |
| Ward bulk PDF          | `ExportJob` + Playwright Chromium (`page.pdf` A4)             |
| Visual source of truth | Shared React A4 document (screen, print, Playwright)          |
| Tax rates              | Published ward × AY `TaxConfig` (annual rate already; no ×12) |

## Architecture

- **Report Builder** → `/reports/demand-notices` panel (filters, KPIs, register, preview, print, ward PDF).
- **Nest** `demand-notices` module builds document JSON (floors, photos, ALV rows, tax lines).
- **Print routes** (chrome-free) for browser + Playwright: single survey and ward multi-page.
- **Worker** opens ward print URL with short-lived HMAC token, generates PDF, uploads to S3/MinIO.

## UI (A4 layout)

Match the official sample:

1. Header — logo, office title, Property Tax Demand Notice / संपत्ति कर मांग सूचना पत्र
2. Meta pills — Assessment Year, Notice Date, Property ID
3. Property Specifications | Owner Profile
4. Site Imagery (front + side) | GIS lat/long placeholder
5. Assessment & ALV table + TOTAL
6. Tax summary — Property / Water / Drainage / **Total Demand** (green)
7. Important Notice (Hindi) + Executive Officer signature

Tokens: white page, blue headings, grey label chrome, thin borders, green total, Noto Sans Devanagari + sans.

## Tax formula

Per floor:

- `grossAlv = areaSqFt × annualRatePerSqFt × usageMult`
- `assessableAlv = grossAlv × (assessablePct / 100)`
- Property / water / drainage from summed assessable × config %
- Penalty line only if `penaltyPct > 0`

Rate cell: survey `taxRateZone` ↔ road-width entry; floor `constructionType` ↔ construction entry.

## Errors

| Case                      | Behavior                                   |
| ------------------------- | ------------------------------------------ |
| Non-APPROVED              | Not listed / 404                           |
| No ward for bulk          | UI block + API 400                         |
| Missing tax config / cell | Clear error; register shows “Rate missing” |
| Invalid print token       | 401                                        |
| Playwright failure        | Job FAILED + message                       |

## Out of scope

- `sdv-monorepo-apps` changes
- PDFKit demand notices
- PENDING/REJECTED notices
- Live GIS map tiles
