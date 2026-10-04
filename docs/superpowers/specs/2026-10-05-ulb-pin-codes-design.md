# ULB PIN codes in Geography

Date: 2026-10-05

## Purpose

An administrator registers the postal PIN codes for one ULB. The mobile survey start screen lists those codes in the location PIN menu when the surveyor selects that ULB.

The LGD code on Edit ULB stays the ULB code. Postal PINs live in `UlbPinCode`.

## Decisions

- The screen is its own page, opened from the Geography ULB row. It is not a section inside Edit ULB.
- Add and remove save immediately through the existing PIN endpoints. The page does not batch them into the ULB save.
- A removed code leaves the catalog and the mobile menu. Surveys that already stored `locationPinCode` keep that value.
- There is no edit-in-place. Replacing a code is remove, then add.
- Wards are not filtered by PIN. Address `pinCode` on the Address step is unchanged.

## Page

Route: `/configuration/geography/ulbs/[ulbId]/pin-codes`.

The Geography ULB row gains a **PIN codes** action beside View and Edit. Anyone who can open Geography can use it. Back returns to `/configuration/geography`.

Title: **PIN codes**. The subtitle shows the ULB name, type, and district, and states that these codes are the choices in the mobile survey start PIN menu for this ULB.

The body lists saved codes in numeric order, monospace. Empty copy says no PIN codes are registered yet, and surveyors will have an empty PIN menu for this ULB until one is added.

`settings:manage` sees a six-digit field, **Add**, and **Remove** on each row. `settings:view` sees the list only.

## Saving

**Add** accepts exactly six digits, then `POST /ulbs/:id/pin-codes`. The list refreshes from the server. A value that is not six digits shows “PIN must be 6 digits” and is not sent. A duplicate shows “This PIN is already registered for the ULB.”

**Remove** asks for confirmation, then `DELETE /ulbs/:id/pin-codes/:pinCodeId`. The code disappears from the list.

A failed add or remove leaves the list unchanged and shows the server message. A network failure says the code could not be saved and offers retry.

If the ULB is outside the user’s scope or no longer exists, the page says the ULB was not found and links back to Geography.

## Mobile

The survey start screen loads `GET /ulbs/:id/pin-codes` for the selected ULB and fills the location PIN menu from that response.

Opening the start screen, or changing the ULB, loads the current codes. A surveyor who already has the start screen open sees a newly saved code after leaving and opening the screen again. The PIN query must not keep a stale list across that reopen.

A survey whose saved PIN is no longer in the catalog keeps the stored value until the surveyor picks a code that is still listed and saves the start step.

## Tests

API tests:

- Adding `207001` returns that code and a later list includes it.
- `12345` is rejected and is not stored.
- Adding the same code twice returns the duplicate conflict.
- Deleting a code removes it from the catalog and does not change `locationPinCode` on surveys that already stored it.

`apps/web` has no test script. The page is checked with typecheck and a manual pass: add a code, reject a duplicate and a short value, remove a code, then open mobile survey start for that ULB and see the remaining codes in the PIN menu.

## Out of scope

- Pasting many codes at once.
- Putting postal PINs into the Edit ULB code field.
- Clearing `locationPinCode` on existing surveys when a catalog row is deleted.
- A new permission. Read stays on the geography read permissions. Write stays on `settings:manage`.
