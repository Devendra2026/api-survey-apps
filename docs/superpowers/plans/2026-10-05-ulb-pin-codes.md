# ULB PIN Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Geography page saves 6-digit postal PINs for one ULB, and the mobile survey-start PIN menu shows that catalog the next time it opens.

**Architecture:** `POST` and `DELETE /ulbs/:id/pin-codes` already persist `UlbPinCode`. This work adds the dashboard page and the ULB-row link, and stops the mobile PIN query from serving a 30-minute-old list. Deleting a catalog row does not write `Survey.locationPinCode`.

**Tech Stack:** NestJS 11, Jest, Next.js 16, TanStack Query, `@workspace/ui`, Expo / React Query.

**Spec:** `docs/superpowers/specs/2026-10-05-ulb-pin-codes-design.md`

## Global Constraints

- No Prisma schema change and no migration. `UlbPinCode` and `Survey.locationPinCode` already exist.
- Route: `/configuration/geography/ulbs/[ulbId]/pin-codes`. Back link: `/configuration/geography`. That route already redirects to `/master-data?tab=tenants`, where `GeographyAccordion` is rendered from `TenantsWardsPanel`. Do not rebuild the geography tree on the redirect page.
- The **PIN codes** control sits on the ULB row in `GeographyAccordion`, beside View and Edit. It is visible when `canManage` is false. Edit ULB stays district, name, LGD code, and type. Do not put PINs in that drawer or in the LGD code field.
- `settings:manage` shows the 6-digit field, **Add**, and **Remove**. Anyone who can open the page sees the list. No new permission.
- Add and remove call the API immediately. No batching into ULB save. No edit-in-place. No bulk paste.
- Exact strings:
  - `PIN must be 6 digits`
  - `This PIN is already registered for the ULB`
  - `The code could not be saved. Try again.`
  - `ULB was not found`
  - Empty list: `No PIN codes are registered yet. Surveyors will have an empty PIN menu for this ULB until one is added.`
  - Subtitle must name the ULB, its type, its district, and say these codes are the mobile survey-start PIN menu for this ULB.
- A failed add or remove leaves the list as last loaded from the server. A network failure shows the save sentence and a **Retry** button.
- Remove asks for confirmation. Confirming deletes only the catalog row. Do not update or clear `Survey.locationPinCode`.
- Do not filter wards by PIN. Do not change address `Survey.pinCode`.
- `apps/web` has no Jest script. Pure helpers use `node:test`, same as `features/configuration/lib/tax-preview-request.spec.ts`. The page is typecheck plus the manual pass at the end.
- On Windows PowerShell, do not chain commands with `&&`.

## File structure

- Modify `apps/api/src/ulbs/ulbs.repository.spec.ts` — create, duplicate conflict, delete leaves surveys alone.
- Create `apps/web/features/configuration/lib/pin-code-input.ts` — client gate and user-facing failure copy.
- Create `apps/web/features/configuration/lib/pin-code-input.spec.ts` — node:test for that gate.
- Create `apps/web/features/configuration/lib/ulb-pin-codes-api.ts` — `listUlbPinCodes`, `createUlbPinCode`, `deleteUlbPinCode`.
- Create `apps/web/app/(dashboard)/configuration/geography/ulbs/[ulbId]/pin-codes/page.tsx` — the page.
- Modify `apps/web/features/configuration/components/GeographyAccordion.tsx` — **PIN codes** link on every ULB row.
- Modify `apps/mobile/src/features/surveys/hooks/queries.ts` — `useUlbPinCodes` refetches on mount.

---

### Task 1: Catalog add, duplicate, and delete tests

**Files:**

- Test: `apps/api/src/ulbs/ulbs.repository.spec.ts`
- Modify: `apps/api/src/ulbs/ulbs.repository.ts` only if a test fails. The methods `createPinCode` and `deletePinCode` already match the spec. Do not change them when the tests pass.

**Interfaces:**

- Consumes: `UlbsRepository.createPinCode`, `listPinCodes`, `deletePinCode`.
- Produces: no new public methods.

- [ ] **Step 1: Extend the Prisma mock**

In `ulbs.repository.spec.ts`, add these fns next to `pinCreate`:

```ts
const pinFindFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const pinDelete = jest.fn<(...args: unknown[]) => Promise<unknown>>()
```

Change the `ulbPinCode` mock to:

```ts
ulbPinCode: {
  deleteMany: pinDeleteMany,
  findMany: pinFindMany,
  findFirst: pinFindFirst,
  create: pinCreate,
  delete: pinDelete,
},
```

In `beforeEach`, after `pinCreate.mockReset()`, add:

```ts
pinFindFirst.mockReset()
pinDelete.mockReset()
```

- [ ] **Step 2: Add the three tests**

Append these tests inside the existing `describe` block, after the test named `rejects a PIN that is not 6 digits`:

```ts
it("stores a 6-digit PIN and a later list includes it", async () => {
  ulbFindFirst.mockResolvedValue({ id: "ulb-1", districtId: "district-1" })
  pinCreate.mockResolvedValueOnce({ id: "pin-1", code: "207001" })
  await expect(repo.createPinCode("ulb-1", "207001", admin)).resolves.toEqual({
    id: "pin-1",
    code: "207001",
  })
  expect(pinCreate).toHaveBeenCalledWith({
    data: { ulbId: "ulb-1", code: "207001" },
    select: { id: true, code: true },
  })
  pinFindMany.mockResolvedValueOnce([{ id: "pin-1", code: "207001" }])
  await expect(repo.listPinCodes("ulb-1", admin)).resolves.toEqual([{ id: "pin-1", code: "207001" }])
})

it("rejects a second add of the same PIN", async () => {
  ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1" })
  pinCreate.mockRejectedValueOnce({ code: "P2002" })
  await expect(repo.createPinCode("ulb-1", "207001", admin)).rejects.toThrow(
    "This PIN is already registered for the ULB"
  )
})

it("removes a catalog PIN without changing surveys", async () => {
  ulbFindFirst.mockResolvedValueOnce({ id: "ulb-1", districtId: "district-1" })
  pinFindFirst.mockResolvedValueOnce({ id: "pin-1" })
  pinDelete.mockResolvedValueOnce({ id: "pin-1" })
  await repo.deletePinCode("ulb-1", "pin-1", admin)
  expect(pinDelete).toHaveBeenCalledWith({ where: { id: "pin-1" } })
  expect(surveyUpdateMany).not.toHaveBeenCalled()
  expect(surveyDeleteMany).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run the repository spec**

```powershell
pnpm --filter api test -- src/ulbs/ulbs.repository.spec.ts --no-coverage
```

Expected: the new tests pass. The existing `lists 6-digit PIN codes` and `rejects a PIN that is not 6 digits` tests still pass. Do not call `jest` directly (`pnpm --filter api exec jest` fails with TS5098). Use `apps/api/scripts/run-jest.mjs` via the `test` script.

- [ ] **Step 4: Commit**

```powershell
git add apps/api/src/ulbs/ulbs.repository.spec.ts
git commit -m "Test ULB PIN catalog add, duplicate, and delete."
```

---

### Task 2: Client PIN gate

**Files:**

- Create: `apps/web/features/configuration/lib/pin-code-input.ts`
- Test: `apps/web/features/configuration/lib/pin-code-input.spec.ts`

**Interfaces:**

- Produces:
  - `pinCodeInputError(raw: string): string | null`
  - `PIN_DUPLICATE_MESSAGE: "This PIN is already registered for the ULB"`
  - `PIN_NETWORK_FAILURE_MESSAGE: "The code could not be saved. Try again."`
  - `PIN_EMPTY_MESSAGE: "No PIN codes are registered yet. Surveyors will have an empty PIN menu until one is added."`
  - `ULB_NOT_FOUND_MESSAGE: "ULB was not found"`

- [ ] **Step 1: Write the failing test**

Create `apps/web/features/configuration/lib/pin-code-input.spec.ts`:

```ts
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PIN_DUPLICATE_MESSAGE, pinCodeInputError } from "./pin-code-input.ts"

describe("pinCodeInputError", () => {
  it("returns null for exactly six digits", () => {
    assert.equal(pinCodeInputError("207001"), null)
    assert.equal(pinCodeInputError(" 207001 "), null)
  })

  it("rejects a short value and does not treat it as ready to send", () => {
    assert.equal(pinCodeInputError("12345"), "PIN must be 6 digits")
    assert.equal(pinCodeInputError("2070011"), "PIN must be 6 digits")
    assert.equal(pinCodeInputError("20700a"), "PIN must be 6 digits")
    assert.equal(pinCodeInputError(""), "PIN must be 6 digits")
  })

  it("keeps the server duplicate sentence stable", () => {
    assert.equal(PIN_DUPLICATE_MESSAGE, "This PIN is already registered for the ULB")
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```powershell
pnpm --filter web exec node --experimental-strip-types --test features/configuration/lib/pin-code-input.spec.ts
```

Expected: FAIL because `pin-code-input.ts` does not exist.

- [ ] **Step 3: Write the helper**

Create `apps/web/features/configuration/lib/pin-code-input.ts`:

```ts
/** Six-digit postal PIN, the same shape as POST /ulbs/:id/pin-codes. */
const PIN_CODE_PATTERN = /^\d{6}$/

export const PIN_DUPLICATE_MESSAGE = "This PIN is already registered for the ULB"
export const PIN_NETWORK_FAILURE_MESSAGE = "The code could not be saved. Try again."
export const PIN_EMPTY_MESSAGE =
  "No PIN codes are registered yet. Surveyors will have an empty PIN menu for this ULB until one is added."
export const ULB_NOT_FOUND_MESSAGE = "ULB was not found"

/**
 * Client gate before POST. Null means the trimmed value is safe to send.
 */
export function pinCodeInputError(raw: string): string | null {
  if (PIN_CODE_PATTERN.test(raw.trim())) return null
  return "PIN must be 6 digits"
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```powershell
pnpm --filter web exec node --experimental-strip-types --test features/configuration/lib/pin-code-input.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/features/configuration/lib/pin-code-input.ts apps/web/features/configuration/lib/pin-code-input.spec.ts
git commit -m "Validate a ULB PIN before it is sent."
```

---

### Task 3: PIN codes page

**Files:**

- Create: `apps/web/features/configuration/lib/ulb-pin-codes-api.ts`
- Create: `apps/web/app/(dashboard)/configuration/geography/ulbs/[ulbId]/pin-codes/page.tsx`

**Interfaces:**

- Consumes: `apiGet`, `apiPost`, `apiDelete`, `getApiErrorMessage` from `@/lib/api/client`; `useUlb`, `useDistrict` from `@/hooks/use-api`; `useAuthStore` from `@/stores/app-store`; `GeoUlb.type` is `MUNICIPAL_COUNCIL` or `TOWN_PANCHAYAT`.
- Produces:
  - `listUlbPinCodes(ulbId: string): Promise<UlbPinCodeItem[]>`
  - `createUlbPinCode(ulbId: string, code: string): Promise<UlbPinCodeItem>`
  - `deleteUlbPinCode(ulbId: string, pinCodeId: string): Promise<void>`
  - `UlbPinCodeItem = { id: string; code: string }`

- [ ] **Step 1: Add the web API wrappers**

Create `apps/web/features/configuration/lib/ulb-pin-codes-api.ts`:

```ts
import { apiDelete, apiGet, apiPost } from "@/lib/api/client"

export interface UlbPinCodeItem {
  readonly id: string
  readonly code: string
}

export function listUlbPinCodes(ulbId: string): Promise<UlbPinCodeItem[]> {
  return apiGet<UlbPinCodeItem[]>(`/ulbs/${ulbId}/pin-codes`)
}

export function createUlbPinCode(ulbId: string, code: string): Promise<UlbPinCodeItem> {
  return apiPost<UlbPinCodeItem>(`/ulbs/${ulbId}/pin-codes`, { code })
}

export async function deleteUlbPinCode(ulbId: string, pinCodeId: string): Promise<void> {
  await apiDelete<unknown>(`/ulbs/${ulbId}/pin-codes/${pinCodeId}`)
}
```

- [ ] **Step 2: Add the page**

Create `apps/web/app/(dashboard)/configuration/geography/ulbs/[ulbId]/pin-codes/page.tsx`:

```tsx
"use client"

import {
  PIN_DUPLICATE_MESSAGE,
  PIN_EMPTY_MESSAGE,
  PIN_NETWORK_FAILURE_MESSAGE,
  ULB_NOT_FOUND_MESSAGE,
  pinCodeInputError,
} from "@/features/configuration/lib/pin-code-input"
import {
  createUlbPinCode,
  deleteUlbPinCode,
  listUlbPinCodes,
  type UlbPinCodeItem,
} from "@/features/configuration/lib/ulb-pin-codes-api"
import { useDistrict, useUlb } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { useAuthStore } from "@/stores/app-store"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import axios from "axios"
import Link from "next/link"
import { use, useState } from "react"

function formatUlbType(type: string): string {
  if (type === "TOWN_PANCHAYAT") return "Town Panchayat"
  if (type === "MUNICIPAL_COUNCIL") return "Municipal Council"
  return type
}

function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404
}

function isNetworkFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response
}

type RetryAction = { kind: "add"; code: string } | { kind: "remove"; pinCodeId: string }

export default function UlbPinCodesPage({ params }: { params: Promise<{ ulbId: string }> }) {
  const { ulbId } = use(params)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission("settings:manage")
  const queryClient = useQueryClient()
  const ulbQuery = useUlb(ulbId)
  const districtQuery = useDistrict(ulbQuery.data?.districtId)
  const pinsQuery = useQuery({
    queryKey: ["ulb-pin-codes", ulbId],
    queryFn: () => listUlbPinCodes(ulbId),
    enabled: Boolean(ulbId) && ulbQuery.isSuccess,
  })
  const [draft, setDraft] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null)
  const [pending, setPending] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<UlbPinCodeItem | null>(null)
  const pins = pinsQuery.data ?? []

  async function refreshPins(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ["ulb-pin-codes", ulbId] })
  }

  async function runAdd(code: string): Promise<void> {
    setPending(true)
    setFormError(null)
    setRetryAction(null)
    try {
      await createUlbPinCode(ulbId, code)
      setDraft("")
      await refreshPins()
    } catch (error) {
      setFormError(isNetworkFailure(error) ? PIN_NETWORK_FAILURE_MESSAGE : getApiErrorMessage(error))
      if (isNetworkFailure(error)) setRetryAction({ kind: "add", code })
    } finally {
      setPending(false)
    }
  }

  async function runRemove(pinCodeId: string): Promise<void> {
    setPending(true)
    setFormError(null)
    setRetryAction(null)
    setRemoveTarget(null)
    try {
      await deleteUlbPinCode(ulbId, pinCodeId)
      await refreshPins()
    } catch (error) {
      setFormError(isNetworkFailure(error) ? PIN_NETWORK_FAILURE_MESSAGE : getApiErrorMessage(error))
      if (isNetworkFailure(error)) setRetryAction({ kind: "remove", pinCodeId })
    } finally {
      setPending(false)
    }
  }

  function submitAdd(): void {
    const error = pinCodeInputError(draft)
    if (error) {
      setFormError(error)
      setRetryAction(null)
      return
    }
    const code = draft.trim()
    if (pins.some((pin) => pin.code === code)) {
      setFormError(PIN_DUPLICATE_MESSAGE)
      setRetryAction(null)
      return
    }
    void runAdd(code)
  }

  function retry(): void {
    if (!retryAction) return
    if (retryAction.kind === "add") {
      void runAdd(retryAction.code)
      return
    }
    void runRemove(retryAction.pinCodeId)
  }

  if (ulbQuery.isError && isNotFound(ulbQuery.error)) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3 p-6">
        <p className="text-sm">{ULB_NOT_FOUND_MESSAGE}</p>
        <Link href="/configuration/geography" className="text-sm underline">
          Back to Geography
        </Link>
      </div>
    )
  }

  const ulb = ulbQuery.data
  const districtName = districtQuery.data?.name
  const subtitle =
    ulb && districtName
      ? `${ulb.name}, ${formatUlbType(ulb.type)}, ${districtName}. These codes are the mobile survey-start PIN menu for this ULB.`
      : "These codes are the mobile survey-start PIN menu for this ULB."

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <Link href="/configuration/geography" className="text-sm underline">
        Back
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>PIN codes</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {pinsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading PIN codes…</p> : null}
          {pinsQuery.isError ? <p className="text-sm text-destructive">{getApiErrorMessage(pinsQuery.error)}</p> : null}
          {pinsQuery.isSuccess && pins.length === 0 ? (
            <p className="text-sm text-muted-foreground">{PIN_EMPTY_MESSAGE}</p>
          ) : null}
          {pins.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {pins.map((pin) => (
                <li key={pin.id} className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm">{pin.code}</span>
                  {canManage ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setRemoveTarget(pin)}>
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {canManage ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                submitAdd()
              }}
            >
              <Label htmlFor="ulb-pin-code">PIN</Label>
              <div className="flex gap-2">
                <Input
                  id="ulb-pin-code"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="6 digits"
                />
                <Button type="submit" disabled={pending}>
                  Add
                </Button>
              </div>
            </form>
          ) : null}
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          {retryAction ? (
            <Button type="button" variant="outline" disabled={pending} onClick={retry}>
              Retry
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removeTarget?.code}?</DialogTitle>
            <DialogDescription>
              This PIN leaves the survey-start menu. Surveys that already saved it keep that value.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || !removeTarget}
              onClick={() => {
                if (removeTarget) void runRemove(removeTarget.id)
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

The list renders `pins` in API order. `listPinCodes` already uses `orderBy: { code: "asc" }`, which is numeric order for 6-digit codes. Do not sort again.

Do not optimistic-update the list. `refreshPins` runs only after a successful add or remove, so a failure leaves the previous server list on screen.

- [ ] **Step 3: Typecheck the web app**

```powershell
pnpm --filter web typecheck
```

Expected: PASS. Fix only type errors in the two new files.

- [ ] **Step 4: Commit**

```powershell
git add apps/web/features/configuration/lib/ulb-pin-codes-api.ts "apps/web/app/(dashboard)/configuration/geography/ulbs/[ulbId]/pin-codes/page.tsx"
git commit -m "Add the Geography page that saves ULB PIN codes."
```

---

### Task 4: ULB row link

**Files:**

- Modify: `apps/web/features/configuration/components/GeographyAccordion.tsx`

**Interfaces:**

- Consumes: `ulb.id` on `GeographyTreeNode`.
- Produces: a link to `/configuration/geography/ulbs/${ulb.id}/pin-codes` labeled `PIN codes`.

- [ ] **Step 1: Add the link on every ULB row**

Import `Link` from `next/link` at the top of `GeographyAccordion.tsx`.

In `UlbCard`, immediately after the View button (`aria-label="View ULB"`) and before the `{canManage ? (` Edit button, insert:

```tsx
<Button type="button" size="sm" variant="ghost" className="cursor-pointer" asChild>
  <Link href={`/configuration/geography/ulbs/${ulb.id}/pin-codes`}>PIN codes</Link>
</Button>
```

Do not wrap this button in `canManage`. Do not add a callback through `TenantsWardsPanel`. Do not change Edit or Delete.

- [ ] **Step 2: Typecheck**

```powershell
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add apps/web/features/configuration/components/GeographyAccordion.tsx
git commit -m "Open ULB PIN codes from the Geography row."
```

---

### Task 5: Fresh PIN menu on the survey start screen

**Files:**

- Modify: `apps/mobile/src/features/surveys/hooks/queries.ts` (`useUlbPinCodes` only)

**Interfaces:**

- Consumes: `listUlbPinCodes` already used by `useUlbPinCodes`.
- Produces: the same hook, with `staleTime: 0` and `refetchOnMount: "always"`.

- [ ] **Step 1: Drop the 30-minute cache for PIN codes**

Replace `useUlbPinCodes` with:

```ts
export function useUlbPinCodes(ulbId: string | null) {
  return useQuery({
    queryKey: surveyKeys.pinCodes(ulbId ?? ""),
    queryFn: () => listUlbPinCodes(ulbId ?? ""),
    enabled: Boolean(ulbId),
    staleTime: 0,
    refetchOnMount: "always",
  })
}
```

Leave `useDistrictUlbs` and `useUlbWards` at `staleTime: 30 * 60_000`. Do not clear `locationPinCode` on the client or server when a catalog row disappears. `resolvePin` in `start-survey-screen.tsx` already withholds an unlisted saved PIN from the selectable value after a successful load.

- [ ] **Step 2: Typecheck mobile**

```powershell
pnpm --filter mobile typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add apps/mobile/src/features/surveys/hooks/queries.ts
git commit -m "Reload ULB PIN codes when survey start opens."
```

---

### Task 6: Manual pass

No new files. `apps/web` has no page test runner.

- [ ] **Step 1: Re-run the automated checks**

```powershell
pnpm --filter api test -- src/ulbs/ulbs.repository.spec.ts --no-coverage
pnpm --filter web exec node --experimental-strip-types --test features/configuration/lib/pin-code-input.spec.ts
pnpm --filter web typecheck
pnpm --filter mobile typecheck
```

Expected: all four pass.

- [ ] **Step 2: Walk the page**

With a user who has `settings:manage`, open Master Data → Tenants, expand a ULB, and choose **PIN codes**.

- Add `207001`. The list shows it in monospace. Leave the page and open survey start for that ULB. The PIN menu includes `207001`.
- Add `207001` again. The page shows `This PIN is already registered for the ULB` and the list stays one row.
- Add `12345`. The page shows `PIN must be 6 digits` and does not add a row.
- Remove `207001` and confirm. The row disappears. A survey that already stored `207001` in `locationPinCode` still has that value.
- Open the start screen again. `207001` is gone from the menu. A draft that still has that stored PIN is not a selected menu value until the surveyor picks a code that is still listed and saves the start step.
- Sign in as `settings:view` only. The list is visible. Add and Remove are absent. The **PIN codes** row action is still present.
- Open `/configuration/geography/ulbs/does-not-exist/pin-codes`. The page shows `ULB was not found` and a link back to Geography.

---

## Self-review

- Spec route, back link, row action, and Edit ULB boundary are in Tasks 3 and 4.
- Add, duplicate, short PIN, remove confirmation, unchanged survey PIN, and mobile reopen are in Tasks 1, 3, 5, and 6.
- No schema, bulk paste, in-place edit, new permission, ward filter, or address `pinCode` change.
- Web page verification is typecheck plus the manual pass, matching the spec.
