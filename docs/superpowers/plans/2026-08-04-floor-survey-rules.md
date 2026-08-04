# Floor Survey Rules — Implementation Plan

**Date:** 2026-08-04  
**Spec:** [2026-08-04-floor-survey-rules-design.md](../specs/2026-08-04-floor-survey-rules-design.md)

## Done

1. Shared validation: per-floor plot hard semantics via soft warnings; FAR hard cap removed; `sumBuiltUpArea` / `isOpenLandPropertyUse`; `FLOOR_AREA_UNUSUALLY_HIGH` (plot × 3); per-position plinth only.
2. Prisma: `FIFTH_FLOOR` / `SIXTH_FLOOR`; migrate `FIFTH_FLOOR_PLUS`; backfill built-up.
3. API floors: per-position hard check only; reject OPEN_LAND property use; countable recalculate.
4. QC UI: live built-up; open land N/A + disabled editor; floor options through Sixth.
5. QC correct: zero built-up when Property Use set to OPEN_LAND; sync floors use countable sum + sq m.
