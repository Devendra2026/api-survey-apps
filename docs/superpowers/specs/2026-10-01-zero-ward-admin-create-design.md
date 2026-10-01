# Zero Ward admin create and delete

Date: 2026-10-01

## Purpose

A Zero Ward is the quarantine bin for duplicate and reconciliation surveys. An admin creates it and an admin soft-deletes it. The system does not create one as a side effect of reading or of moving a survey.

District, ULB, and geographic-ward deletion stay as they are today.

## Decisions

- Admin delete of a district, ULB, or geographic ward remains blocked while children or surveys still require it. This change does not add cascade delete and does not delete surveys.
- Zero Ward delete is a soft delete (`deletedAt`), including when surveys still point at that ward.
- QC "Move to Zero Ward" stays visible. If no active Zero Ward exists, the move fails with a clear message.
- Create is a dedicated **Create Zero Ward** action. The normal Add Ward form stays for geographic wards only.
- Surveys on a soft-deleted Zero Ward stay on that row and stay visible in QC. A newly created Zero Ward does not receive them.

## Behavior

Nothing creates a Zero Ward while listing wards, adding a geographic ward, opening the command center, or quarantining a survey.

An admin with `settings:manage` uses **Create Zero Ward** on a ULB. That action inserts one active ward:

| Field      | Value       |
| ---------- | ----------- |
| wardNumber | `0`         |
| wardName   | `Zero Ward` |
| kind       | `ZERO`      |

The button is hidden while that ULB already has an active Zero Ward. There is at most one active Zero Ward per ULB.

**Add ward** rejects ward number `0` and the name `Zero Ward`.

Delete sets `deletedAt`. Survey rows are not updated. Those surveys remain on the soft-deleted ward and remain visible in the ULB QC list, still displayed as Zero Ward. The next successful quarantine uses only the new active Zero Ward.

Existing Zero Ward rows stay until an admin soft-deletes them. This change does not migrate or delete them.

### Unchanged delete rules

| Entity          | Delete      | Blocked when                                                                                                                                        |
| --------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| District        | Permanent   | Any ULB, survey, or user role still points at it                                                                                                    |
| ULB             | Permanent   | Any active geographic ward exists, or any survey is linked. A Zero Ward (active or already soft-deleted) may be removed with an otherwise empty ULB |
| Geographic ward | Soft delete | Not blocked by surveys on that ward                                                                                                                 |

## API

No schema migration. A Zero Ward remains a `wards` row. The partial unique index on `(ulbId, wardNumber)` where `deletedAt` is null already allows number `0` to be created again after a soft delete.

### `POST /ulbs/:ulbId/zero-ward`

Implemented on the ULBs controller. Permission: `settings:manage`. The insert itself lives in the zero-ward service and is not called from list, catalog, or QC paths.

Inserts number `0`, name `Zero Ward`, kind `ZERO`.

- If this ULB already has an active Zero Ward (`kind` `ZERO`, `deletedAt` null), return 409 and do not insert another.
- If an active ward already uses number `0`, or is already named Zero Ward, return 409 and do not change that ward's kind. Do not adopt or relabel an existing geographic ward.

### `DELETE /wards/:id`

Soft-deletes a Zero Ward the same way it soft-deletes a geographic ward. Surveys are left unchanged.

### `PATCH /wards/:id`

Rejects changes to number, name, or kind on a Zero Ward.

### `POST /wards`

Rejects number `0` and the name `Zero Ward`. Does not create a Zero Ward afterward.

### Reads

These paths only read. They do not insert a ward:

- Ward list for a ULB (`WardsRepository.findAll`)
- Command-center ward catalog (`WardCatalogService.listScopedWards`)
- QC quarantine (`QcRepository.quarantineToZeroWard`)

Remove every call to `ensureZeroWard`. Replace that helper with an explicit create used only by `POST /ulbs/:ulbId/zero-ward`, and a lookup of the active Zero Ward used by QC. The lookup returns no row when none is active. It does not create one.

QC quarantine looks up the active Zero Ward for the survey's ULB. If none exists, it throws a bad request and does not insert a ward. If one exists, it connects the survey to that ward and sets `originalWardId` as it does today.

`listUnresolvedQuarantineSurveys` stays a read-only helper for surveys on an active Zero Ward. It is not the QC list. This change does not start calling it, and it does not need to include soft-deleted Zero Wards.

## Screens

**Create Zero Ward** sits next to **Add ward** in `GeographyAccordion`, for `settings:manage` only. It is hidden while the loaded ward list contains an active Zero Ward. The Zero Ward pill stays in that list so the admin can open it and delete it.

The master-data delete dialog (`tenants-wards-panel`) stops blocking Zero Ward. Confirming delete soft-deletes it, including when surveys still point at it.

The QC review action **Move to Zero Ward** stays visible. The existing error toast shows the API message.

Geography and the ward catalog already omit rows with `deletedAt` set, so a soft-deleted Zero Ward leaves the ward pills and the ward picker, and **Create Zero Ward** shows again.

QC survey queries filter `survey.deletedAt`, not the ward's `deletedAt`. Surveys whose current ward is a soft-deleted Zero Ward stay on the ULB QC list and still display as Zero Ward. The soft-deleted ward is not a selectable ward-picker entry.

## Errors

Anyone without `settings:manage` receives the existing 403.

| Action                                                          | Result                                                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Create Zero Ward when this ULB already has an active one        | 409, "This ULB already has an active Zero Ward."                                                          |
| Create Zero Ward when an active ward already uses number `0`    | 409, "Cannot create Zero Ward — ward number 0 is already used by another ward."                           |
| Create Zero Ward when an active ward is already named Zero Ward | 409, "Cannot create Zero Ward — the name Zero Ward is already used by another ward."                      |
| Add ward with number `0`                                        | 400, "Ward number 0 is reserved for Zero Ward. Use Create Zero Ward."                                     |
| Add ward with the name Zero Ward                                | 400, "The name Zero Ward is reserved. Use Create Zero Ward." Number is checked first when both are wrong. |
| Edit a Zero Ward's number, name, or kind                        | 400, "Zero Ward number, name, and kind cannot be changed."                                                |
| Move to Zero Ward when none is active                           | 400, "An admin must create the Zero Ward for this ULB before surveys can be moved there."                 |
| Delete a Zero Ward that still has surveys                       | Soft delete succeeds. Survey rows are left as they are.                                                   |

District, ULB, and geographic-ward conflict messages stay as they are.

## Tests

- Creating a Zero Ward inserts number `0`, name `Zero Ward`, kind `ZERO`. A second create returns 409. A geographic ward that already owns number `0` or that name also returns 409, and that ward's kind is not changed.
- Ward list, ward create, and the command-center catalog do not insert a Zero Ward.
- Normal ward create rejects number `0` and the name Zero Ward.
- Deleting a Zero Ward sets `deletedAt` and does not update surveys. Patching its number, name, or kind is rejected.
- QC quarantine uses the active Zero Ward when one exists. When none exists, it returns the admin message and does not insert a ward.
- A survey whose current ward is a soft-deleted Zero Ward still appears on the ULB QC list and still displays as Zero Ward.
- Existing ULB-delete tests stay valid: an otherwise empty ULB can still be deleted, and its Zero Ward goes with it. A ULB with surveys or active geographic wards still cannot.

## Out of scope

- Cascade delete of districts, ULBs, wards, or surveys.
- Changing district, ULB, or geographic-ward delete rules.
- Moving surveys off a soft-deleted Zero Ward when a new one is created.
- A ULB flag or toggle for Zero Ward.
- Schema or migration changes.
