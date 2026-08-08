# Ward-1 Etah Floor Redesign (WARD 1.xlsx QC layout)

**Date:** 2026-08-08  
**Status:** Approved (revised to match `WARD 1.xlsx`)  
**Scope:** One-off openpyxl transform; no Nest export changes

## Goal

Rewrite floor columns from premium flat `ETM/1-Ward-1-Etah.xlsx` into the multi-header floor design used by `WARD 1.xlsx`, as a QC-style sheet (identity + floors + areas only; no tax columns).

## Locked decisions

| Decision           | Choice                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Reference          | `WARD 1.xlsx` Survey Data floor block                                                                                   |
| Identity columns   | SN … Road Type (16 cols), mapped from premium source                                                                    |
| Open Land          | Columns 36–37 merged (WARD 1); area in col 36 only                                                                      |
| Floor area empties | Write `0` for all Res/Non-Res/Open Land cells                                                                           |
| Seventh Floor      | Always `0`                                                                                                              |
| Floors abbrev      | WARD pattern: `B`? + `G`? + `F{maxUpper}`? else `P` (e.g. GF2, BGF1)                                                    |
| Totals             | Copy Plot/Plinth/Built; if Built blank/0 → sum floor Res+Non-Res; if Plinth blank/0 and Ground > 0 → Ground Res+Non-Res |
| Res/Non-Res        | Usage Factor first (Commercial/Godown/Shop/Non-Residential/Mix → Non-Res); else residential keywords; empty → Res       |
| Output             | `ETM/1-Ward-1-Etah-floor-redesign.xlsx`                                                                                 |

## Column layout (1-based)

1–16 identity · 17 Floors · 18–35 floor Res/Non-Res pairs (Basement…Seventh) · 36–37 Open Land · 38–40 Plot/Plinth/Total Built Up

## Header

4 rows; identity + Plot/Plinth/Total vertical merges 1–4; Floors band `Q1:AK1`; floor group merges on row 2; Res/Non-Res merges rows 3–4; Open Land `AJ2:AK2` / `AJ3:AK4`; “Floor” at Q4. Bold, light-blue fill, thin borders, center, wrap. Freeze `A5`. AutoFilter.

## Sort

Parcel Number ascending (numeric); blank/N/A/NA last; SN = 1…N after sort.
