# QC Supervisor Workflow Hardening

**Date:** 2026-08-01  
**Status:** Implementing (P0 save-safety + queue ward)  
**App:** `api-survey-apps` QC module

## Workflow (expected)

1. Surveyor submits survey via mobile → status `SUBMITTED` / QC `PENDING`.
2. QC Supervisor opens filled form, verifies against field reality.
3. QC edits fields → **Save** → **Approve** (or Return / Reopen / Delete).
4. After Approve, next pending parcel in ward should open automatically.

## Audit findings

### P0 — implemented in this pass

| Issue                                                                     | Fix                                            |
| ------------------------------------------------------------------------- | ---------------------------------------------- |
| `parcelNumber: null` → `.replace` crash on Save                           | Null-safe pad                                  |
| `@Type(() => Number)` turns `null` → `0` (familySize, areas, GPS, floors) | Preserve null via `@Transform` + `@ValidateIf` |
| Toast shows only “Validation failed”                                      | Prefer `errors[]` in `getApiErrorMessage`      |
| Save can wipe floors added via floor API (stale draft)                    | Send `survey.editable.floors` on correct       |
| Stale Active Ward breaks next-parcel after Approve                        | Neighbors use **survey ward**                  |

### P1 — follow-up (documented, not in this pass)

- Return/Reject UI (API exists, no button)
- Cancel Edit does not undo floor/photo API mutations
- REJECTED “Reopen” → `REOPENED` not Pending QC
- Start QC → registry instead of first queue parcel
- Soft-delete does not advance to next parcel
- Implicit identity swap has no toast/confirmation
- Incomplete geo Save message clarity
- Property ID not recomputed when parcel/unit/use incomplete

### P2 — later

- QC photo:create permission; Parcel shared tab; Etah soft-defaults; draft sync during render

## Non-goals this pass

- Dedicated swap UI, Reject/Return UI, RBAC catalog changes, registry tab redesign
