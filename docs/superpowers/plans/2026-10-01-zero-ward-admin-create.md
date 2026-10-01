# Zero Ward Admin Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin creates and soft-deletes the Zero Ward; listing wards, the command-center catalog, and QC quarantine never insert one.

**Architecture:** `createZeroWard` and `findActiveZeroWard` replace `ensureZeroWard`. Only `POST /ulbs/:ulbId/zero-ward` calls `createZeroWard`. QC quarantine calls `findActiveZeroWard` and returns 400 when the row is missing. Geographic ward create rejects number `0` and the name Zero Ward. Zero Ward delete is the existing soft delete.

**Tech Stack:** NestJS 11, Prisma, Jest, Next.js 16, `@workspace/validation`.

## Global Constraints

- No schema migration.
- Zero Ward row: `wardNumber` `0`, `wardName` `Zero Ward`, `kind` `ZERO`.
- At most one active Zero Ward per ULB (`kind` `ZERO`, `deletedAt` null).
- Do not adopt or relabel a geographic ward into kind `ZERO`.
- Do not move surveys when a Zero Ward is soft-deleted or when a new one is created.
- District, ULB, and geographic-ward delete rules stay unchanged.
- `listUnresolvedQuarantineSurveys` stays read-only for active Zero Wards and is not called from new paths.
- Permission for create and delete remains `settings:manage` (403 from the existing guard).
- Exact error strings:
  - `This ULB already has an active Zero Ward.`
  - `Cannot create Zero Ward — ward number 0 is already used by another ward.`
  - `Cannot create Zero Ward — the name Zero Ward is already used by another ward.`
  - `Ward number 0 is reserved for Zero Ward. Use Create Zero Ward.`
  - `The name Zero Ward is reserved. Use Create Zero Ward.`
  - `Zero Ward number, name, and kind cannot be changed.`
  - `An admin must create the Zero Ward for this ULB before surveys can be moved there.`
- Add Ward checks number `0` before the reserved name when both are wrong.
- Create Zero Ward checks an existing active Zero Ward, then number `0`, then the name.

## File structure

- Modify `apps/api/src/common/services/zero-ward.service.ts` — `findActiveZeroWard`, `createZeroWard`. Remove `ensureZeroWard`.
- Modify `apps/api/src/common/services/zero-ward.service.spec.ts` — create/lookup tests. Keep the unresolved-list test.
- Modify `apps/api/src/ulbs/ulbs.service.ts` and `ulbs.controller.ts` — `POST :id/zero-ward`.
- Modify `apps/api/src/wards/wards.repository.ts` and its spec — no auto-create; reserved number/name; soft-delete Zero Ward; reject number/name edits.
- Modify `apps/api/src/common/services/ward-catalog.service.ts` and its spec — no auto-create.
- Modify `apps/api/src/qc/qc.repository.ts` and `qc.quarantine.spec.ts` — lookup only.
- Create `apps/api/src/qc/qc.registry-zero-ward.spec.ts` — ULB QC list still returns a survey on a soft-deleted Zero Ward.
- Modify `apps/web/features/configuration/components/GeographyAccordion.tsx` — Create Zero Ward button.
- Modify `apps/web/features/configuration/components/GeoDrawers.tsx` — client rejection of reserved number and name.
- Modify `apps/web/features/master-data/panels/tenants-wards-panel.tsx` — call the endpoint and stop blocking Zero Ward delete.

---

### Task 1: Explicit create and lookup

**Files:**

- Modify: `apps/api/src/common/services/zero-ward.service.ts`
- Test: `apps/api/src/common/services/zero-ward.service.spec.ts`

**Interfaces:**

- Consumes: `ZERO_WARD_NAME`, `ZERO_WARD_NUMBER`, `isZeroWardName`, `normalizeWardNumber` from `@workspace/validation`.
- Produces:
  - `findActiveZeroWard(db, ulbId) => Promise<WardRow | null>`
  - `createZeroWard(db, ulbId) => Promise<WardRow>` throws `ConflictException`
  - `listUnresolvedQuarantineSurveys` unchanged

- [ ] **Step 1: Replace the `ensureZeroWard` tests**

In `zero-ward.service.spec.ts`, change the import to `createZeroWard` and `findActiveZeroWard`. Delete the "adopts a uniquely named zero ward" test. Use this describe block:

```ts
import { ConflictException } from "@nestjs/common"
import { createZeroWard, findActiveZeroWard, listUnresolvedQuarantineSurveys } from "./zero-ward.service.js"

const existing = {
  id: "z1",
  ulbId: "ulb-a",
  wardNumber: "0",
  wardName: "Zero Ward",
  kind: "ZERO" as const,
}

describe("findActiveZeroWard", () => {
  it("returns the active Zero Ward and does not create", async () => {
    const findFirst = jest.fn().mockResolvedValue(existing as never)
    const create = jest.fn()
    const result = await findActiveZeroWard({ ward: { findFirst, findMany: jest.fn(), create } } as never, "ulb-a")
    expect(result).toEqual(existing)
    expect(create).not.toHaveBeenCalled()
  })

  it("returns null when none is active", async () => {
    const findFirst = jest.fn().mockResolvedValue(null as never)
    await expect(
      findActiveZeroWard({ ward: { findFirst, findMany: jest.fn(), create: jest.fn() } } as never, "ulb-a")
    ).resolves.toBeNull()
  })
})

describe("createZeroWard", () => {
  it("inserts number 0, name Zero Ward, kind ZERO", async () => {
    const create = jest.fn(({ data }: { data: { ulbId: string } }) => Promise.resolve({ id: "z-new", ...data }))
    const result = await createZeroWard(
      {
        ward: {
          findFirst: jest.fn().mockResolvedValue(null as never),
          findMany: jest.fn().mockResolvedValue([] as never),
          create,
        },
      } as never,
      "ulb-a"
    )
    expect(result).toEqual({
      id: "z-new",
      ulbId: "ulb-a",
      wardNumber: "0",
      wardName: "Zero Ward",
      kind: "ZERO",
    })
  })

  it("returns 409 when an active Zero Ward already exists and does not insert", async () => {
    const create = jest.fn()
    await expect(
      createZeroWard(
        {
          ward: {
            findFirst: jest.fn().mockResolvedValue(existing as never),
            findMany: jest.fn(),
            create,
          },
        } as never,
        "ulb-a"
      )
    ).rejects.toThrow("This ULB already has an active Zero Ward.")
    expect(create).not.toHaveBeenCalled()
  })

  it("returns 409 when number 0 is taken and does not change that ward", async () => {
    const update = jest.fn()
    const geographic = {
      id: "w-00",
      ulbId: "ulb-a",
      wardNumber: "00",
      wardName: "Central",
      kind: "GEOGRAPHIC" as const,
    }
    await expect(
      createZeroWard(
        {
          ward: {
            findFirst: jest.fn().mockResolvedValue(null as never),
            findMany: jest.fn().mockResolvedValue([geographic] as never),
            create: jest.fn(),
            update,
          },
        } as never,
        "ulb-a"
      )
    ).rejects.toThrow("Cannot create Zero Ward — ward number 0 is already used by another ward.")
    expect(update).not.toHaveBeenCalled()
  })

  it("returns 409 when the name Zero Ward is taken and does not change kind", async () => {
    const named = {
      id: "w12",
      ulbId: "ulb-a",
      wardNumber: "12",
      wardName: "zero ward",
      kind: "GEOGRAPHIC" as const,
    }
    const update = jest.fn()
    await expect(
      createZeroWard(
        {
          ward: {
            findFirst: jest.fn().mockResolvedValue(null as never),
            findMany: jest.fn().mockResolvedValue([named] as never),
            create: jest.fn(),
            update,
          },
        } as never,
        "ulb-a"
      )
    ).rejects.toThrow("Cannot create Zero Ward — the name Zero Ward is already used by another ward.")
    expect(update).not.toHaveBeenCalled()
    expect(named.kind).toBe("GEOGRAPHIC")
  })
})
```

Keep the existing `listUnresolvedQuarantineSurveys` describe block.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter api exec node ./scripts/run-jest.mjs src/common/services/zero-ward.service.spec.ts`

Expected: FAIL because `createZeroWard` is not exported.

- [ ] **Step 3: Implement the helpers**

Replace `ensureZeroWard` in `zero-ward.service.ts` with:

```ts
import { ConflictException } from "@nestjs/common"
import { isZeroWardName, normalizeWardNumber, ZERO_WARD_NAME, ZERO_WARD_NUMBER } from "@workspace/validation"
import { isPrismaUniqueConflict } from "../utils/survey-identity.util.js"

type WardRow = {
  id: string
  ulbId: string
  wardNumber: string
  wardName: string
  kind: "GEOGRAPHIC" | "ZERO"
}

type ZeroWardDb = {
  ward: {
    findFirst: (args: { where: Record<string, unknown>; select?: Record<string, boolean> }) => Promise<WardRow | null>
    findMany: (args: { where: Record<string, unknown>; select?: Record<string, boolean> }) => Promise<WardRow[]>
    create: (args: { data: { ulbId: string; wardNumber: string; wardName: string; kind: "ZERO" } }) => Promise<WardRow>
  }
}

const wardSelect = {
  id: true,
  ulbId: true,
  wardNumber: true,
  wardName: true,
  kind: true,
} as const

export async function findActiveZeroWard(db: ZeroWardDb, ulbId: string): Promise<WardRow | null> {
  return db.ward.findFirst({
    where: { ulbId, kind: "ZERO", deletedAt: null },
    select: wardSelect,
  })
}

export async function createZeroWard(db: ZeroWardDb, ulbId: string): Promise<WardRow> {
  const existing = await findActiveZeroWard(db, ulbId)
  if (existing) {
    throw new ConflictException("This ULB already has an active Zero Ward.")
  }

  const active = await db.ward.findMany({
    where: { ulbId, deletedAt: null },
    select: wardSelect,
  })
  if (active.some((ward) => normalizeWardNumber(ward.wardNumber) === ZERO_WARD_NUMBER)) {
    throw new ConflictException("Cannot create Zero Ward — ward number 0 is already used by another ward.")
  }
  if (active.some((ward) => isZeroWardName(ward.wardName))) {
    throw new ConflictException("Cannot create Zero Ward — the name Zero Ward is already used by another ward.")
  }

  try {
    return await db.ward.create({
      data: {
        ulbId,
        wardNumber: ZERO_WARD_NUMBER,
        wardName: ZERO_WARD_NAME,
        kind: "ZERO",
      },
    })
  } catch (error) {
    if (!isPrismaUniqueConflict(error)) throw error
    const raced = await findActiveZeroWard(db, ulbId)
    if (raced) throw new ConflictException("This ULB already has an active Zero Ward.")
    throw new ConflictException("Cannot create Zero Ward — ward number 0 is already used by another ward.")
  }
}
```

Leave `listUnresolvedQuarantineSurveys` as it is. Remove the `update` method from the db type.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter api exec node ./scripts/run-jest.mjs src/common/services/zero-ward.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/services/zero-ward.service.ts apps/api/src/common/services/zero-ward.service.spec.ts
git commit -m "feat: create Zero Ward only through an explicit admin helper"
```

---

### Task 2: Admin endpoint

**Files:**

- Modify: `apps/api/src/ulbs/ulbs.service.ts`
- Modify: `apps/api/src/ulbs/ulbs.controller.ts`

**Interfaces:**

- Consumes: `createZeroWard(db, ulbId)` from Task 1. `UlbsRepository.findById(id, user)`.
- Produces: `UlbsService.createZeroWard(ulbId, user)` and `POST /ulbs/:id/zero-ward`.

- [ ] **Step 1: Add the service method**

```ts
import { PrismaService } from "../prisma/prisma.service.js"
import { createZeroWard } from "../common/services/zero-ward.service.js"

constructor(
  private readonly ulbsRepository: UlbsRepository,
  private readonly prisma: PrismaService,
) {}

createZeroWard(ulbId: string, user: AuthenticatedUser) {
  return this.ulbsRepository.findById(ulbId, user).then(() => createZeroWard(this.prisma.db, ulbId))
}
```

`PrismaModule` is global, so `UlbsModule` does not need a new import.

- [ ] **Step 2: Add the route before `@Get(":id")`**

```ts
@Post(":id/zero-ward")
@RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
@ApiOperation({ summary: "Create the ULB Zero Ward for duplicate and reconciliation surveys" })
createZeroWard(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
  return this.ulbsService.createZeroWard(id, user)
}
```

- [ ] **Step 3: Confirm the API typecheck includes the new method**

Run: `pnpm --filter api typecheck`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ulbs/ulbs.service.ts apps/api/src/ulbs/ulbs.controller.ts
git commit -m "feat: add admin endpoint to create a ULB Zero Ward"
```

---

### Task 3: Ward list, create, update, and delete

**Files:**

- Modify: `apps/api/src/wards/wards.repository.ts`
- Test: `apps/api/src/wards/wards.repository.spec.ts`

**Interfaces:**

- Consumes: `isZeroWardName`, `normalizeWardNumber`, `ZERO_WARD_NUMBER` from `@workspace/validation`.
- Produces: `findAll` does not write. `create` throws `BadRequestException` for reserved number or name. `update` throws `BadRequestException` for number or name on kind `ZERO`. `delete` soft-deletes kind `ZERO`.

- [ ] **Step 1: Update the repository spec**

Change the "allows create when only a soft-deleted ward has the same name" mock so it does not expect a second `findFirst` for `ensureZeroWard`. One `findFirst` of `null` for the name check, then `findMany` of `[]` for the number check, is enough.

Replace "rejects deleting the system Zero Ward" with:

```ts
it("soft-deletes a Zero Ward without updating surveys", async () => {
  findFirst.mockResolvedValueOnce({
    id: "zero-1",
    ulbId: "ulb1",
    wardName: "Zero Ward",
    wardNumber: "0",
    kind: "ZERO",
    deletedAt: null,
  })
  update.mockResolvedValueOnce({ id: "zero-1", deletedAt: new Date("2026-10-01T00:00:00.000Z") })

  const result = await repo.delete("zero-1", admin)

  expect(update).toHaveBeenCalledWith({
    where: { id: "zero-1" },
    data: { deletedAt: expect.any(Date) },
  })
  expect(result.deletedAt).toBeTruthy()
})

it("rejects creating ward number 0", async () => {
  await expect(repo.create({ ulbId: "ulb1", wardNumber: "0", wardName: "Central" })).rejects.toThrow(
    "Ward number 0 is reserved for Zero Ward. Use Create Zero Ward."
  )
  expect(create).not.toHaveBeenCalled()
})

it("rejects creating the name Zero Ward after the number check", async () => {
  await expect(repo.create({ ulbId: "ulb1", wardNumber: "4", wardName: "Zero Ward" })).rejects.toThrow(
    "The name Zero Ward is reserved. Use Create Zero Ward."
  )
})

it("rejects renaming a Zero Ward", async () => {
  findFirst.mockResolvedValueOnce({
    id: "zero-1",
    ulbId: "ulb1",
    wardName: "Zero Ward",
    wardNumber: "0",
    kind: "ZERO",
    deletedAt: null,
  })
  await expect(repo.update("zero-1", { wardName: "Quarantine" }, admin)).rejects.toThrow(
    "Zero Ward number, name, and kind cannot be changed."
  )
  expect(update).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the spec and confirm the new cases fail**

Run: `pnpm --filter api exec node ./scripts/run-jest.mjs src/wards/wards.repository.spec.ts`

Expected: FAIL on the Zero Ward delete and reserved-name cases.

- [ ] **Step 3: Change `WardsRepository`**

Remove the `ensureZeroWard` import and both call sites (`findAll` and `create`).

At the start of `create`, after trimming the name and normalizing the number:

```ts
if (wardNumber === "0") {
  throw new BadRequestException("Ward number 0 is reserved for Zero Ward. Use Create Zero Ward.")
}
if (isZeroWardName(wardName)) {
  throw new BadRequestException("The name Zero Ward is reserved. Use Create Zero Ward.")
}
```

`normalizeWardNumber("0")` and `normalizeWardNumber("00")` both return `"0"`, so the number check uses the normalized value.

In `update`, after `findById`:

```ts
if (existing.kind === "ZERO" && (data.wardNumber !== undefined || data.wardName !== undefined)) {
  throw new BadRequestException("Zero Ward number, name, and kind cannot be changed.")
}
```

In `delete`, delete the block that throws when `kind === "ZERO"` or the name is Zero Ward. Keep the soft-delete update.

Import `BadRequestException` from `@nestjs/common`.

- [ ] **Step 4: Run the spec and confirm it passes**

Run: `pnpm --filter api exec node ./scripts/run-jest.mjs src/wards/wards.repository.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/wards/wards.repository.ts apps/api/src/wards/wards.repository.spec.ts
git commit -m "fix: stop auto-creating Zero Ward and allow admin soft delete"
```

---

### Task 4: Command-center catalog

**Files:**

- Modify: `apps/api/src/common/services/ward-catalog.service.ts`
- Test: `apps/api/src/common/services/ward-catalog.service.spec.ts`

**Interfaces:**

- Consumes: nothing from `zero-ward.service`.
- Produces: `listScopedWards` reads `ward.findMany` only.

- [ ] **Step 1: Assert the catalog does not create**

In the existing "lists only active, non-deleted wards" test, add:

```ts
expect(findFirst).not.toHaveBeenCalled()
```

- [ ] **Step 2: Run the spec and confirm it fails**

Run: `pnpm --filter api exec node ./scripts/run-jest.mjs src/common/services/ward-catalog.service.spec.ts`

Expected: FAIL because `ensureZeroWard` calls `findFirst`.

- [ ] **Step 3: Remove the call**

Delete the `ensureZeroWard` import and `await ensureZeroWard(this.prisma.db, ulbId)` from `listScopedWards`.

- [ ] **Step 4: Run the spec and confirm it passes**

Run: `pnpm --filter api exec node ./scripts/run-jest.mjs src/common/services/ward-catalog.service.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/services/ward-catalog.service.ts apps/api/src/common/services/ward-catalog.service.spec.ts
git commit -m "fix: stop the ward catalog from creating a Zero Ward"
```

---

### Task 5: QC quarantine lookup

**Files:**

- Modify: `apps/api/src/qc/qc.repository.ts`
- Test: `apps/api/src/qc/qc.quarantine.spec.ts`

**Interfaces:**

- Consumes: `findActiveZeroWard(db, ulbId)` from Task 1.
- Produces: `quarantineToZeroWard` connects the survey only when that lookup returns a row.

- [ ] **Step 1: Add the missing-ward test**

```ts
it("does not create a Zero Ward when none is active", async () => {
  const { repo, tx } = makeRepo()
  const wardFindFirst = jest.fn().mockResolvedValue(null as never)
  ;(repo as unknown as { prisma: { db: { ward: { findFirst: typeof wardFindFirst } } } }).prisma.db.ward.findFirst =
    wardFindFirst

  await expect(repo.quarantineToZeroWard("survey-b", "user-1")).rejects.toThrow(
    "An admin must create the Zero Ward for this ULB before surveys can be moved there."
  )
  expect(tx.survey.update).not.toHaveBeenCalled()
})
```

Prefer threading the mock through `makeRepo` with an optional `zeroWard: null` argument instead of casting `repo` if the existing factory can take it. The existing factory already stubs `ward.findFirst` to return the Zero Ward. Add an argument `zeroWard: WardRow | null = defaultZero` and use it in the stub.

- [ ] **Step 2: Run the spec and confirm the new test fails**

Run: `pnpm --filter api exec node ./scripts/run-jest.mjs src/qc/qc.quarantine.spec.ts`

Expected: FAIL because `ensureZeroWard` still inserts when `findFirst` returns null.

- [ ] **Step 3: Switch the repository**

Replace `import { ensureZeroWard }` with `import { findActiveZeroWard }`. Replace the `ensureZeroWard` call:

```ts
const zeroWard = await findActiveZeroWard(this.prisma.db, existing.ulbId)
if (!zeroWard) {
  throw new BadRequestException("An admin must create the Zero Ward for this ULB before surveys can be moved there.")
}
```

- [ ] **Step 4: Run the spec and confirm it passes**

Run: `pnpm --filter api exec node ./scripts/run-jest.mjs src/qc/qc.quarantine.spec.ts`

Expected: PASS. The existing move test still connects `zero-1`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/qc/qc.repository.ts apps/api/src/qc/qc.quarantine.spec.ts
git commit -m "fix: refuse QC quarantine until an admin creates the Zero Ward"
```

---

### Task 6: Soft-deleted Zero Ward stays on the QC list

**Files:**

- Create: `apps/api/src/qc/qc.registry-zero-ward.spec.ts`

**Interfaces:**

- Consumes: `QcRepository.listRegistry`.
- Produces: proof that the list query filters `survey.deletedAt` and still returns a survey whose ward kind is `ZERO`.

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it, jest } from "@jest/globals"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { QcRepository } from "./qc.repository.js"

describe("QcRepository.listRegistry Zero Ward", () => {
  it("returns a survey whose current ward is a soft-deleted Zero Ward", async () => {
    const row = {
      id: "survey-z",
      propertyId: "800726-000-00010-001-R",
      ulbCode: "800726",
      wardNumber: "1",
      parcelNumber: "00010",
      unitSubNo: "001",
      propertyUse: "R",
      surveyStatus: "SUBMITTED",
      qcStatus: "PENDING",
      respondentName: "Owner",
      mobileNumber: null,
      submittedAt: null,
      approvedAt: null,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      assignedTo: null,
      createdBy: { id: "u1", fullName: "Surveyor" },
      ward: { id: "zero-old", wardName: "Zero Ward", wardNumber: "0", kind: "ZERO", deletedAt: new Date() },
      originalWard: { id: "ward-1", wardName: "One", wardNumber: "1", kind: "GEOGRAPHIC" },
      ulb: { id: "ulb-1", name: "ULB", code: "800726" },
      district: { id: "d1", name: "District" },
      coOwners: [],
    }
    const findMany = jest.fn().mockResolvedValue([row] as never)
    const count = jest.fn().mockResolvedValue(1 as never)
    const prisma = {
      db: {
        survey: { findMany, count },
        ulb: { findUnique: jest.fn().mockResolvedValue({ name: "ULB" } as never) },
        district: { findUnique: jest.fn().mockResolvedValue({ name: "District" } as never) },
        ward: { findUnique: jest.fn() },
      },
    }
    const surveysService = { ensureFormulaPropertyId: jest.fn(async (input: { propertyId: string }) => input) }
    const repo = new QcRepository(prisma as never, { listScopedWards: jest.fn() } as never, surveysService as never)
    const user = {
      id: "u1",
      tenantRoles: [
        {
          id: "tr1",
          roleId: "r1",
          roleName: "ADMIN",
          permissions: [],
          stateId: null,
          districtId: null,
          ulbId: null,
          wardId: null,
          isActive: true,
        },
      ],
    } as AuthenticatedUser

    const result = await repo.listRegistry(user, { ulbId: "ulb-1", page: 1, limit: 20 })

    const where = findMany.mock.calls[0]?.[0] as { where: { AND: Array<Record<string, unknown>> } }
    expect(JSON.stringify(where)).not.toContain('"deletedAt":null')
    expect(where.where.AND[0]).toEqual(expect.objectContaining({ deletedAt: null, ulbId: "ulb-1" }))
    expect(where.where.AND[0]).not.toHaveProperty("ward")
    expect(result.items).toEqual([expect.objectContaining({ id: "survey-z" })])
  })
})
```

The first `not.toContain` is wrong because the survey filter itself is `deletedAt: null`. Do not use that assertion. Assert only:

```ts
expect(where.where.AND[0]).toEqual(expect.objectContaining({ deletedAt: null, ulbId: "ulb-1" }))
expect(where.where.AND[0]).not.toHaveProperty("ward")
expect(result.items[0]?.id).toBe("survey-z")
```

`getRegistryCounts` calls `survey.count` five times plus `listRegistry` calls `count` once. Mock `count` to resolve `1` for every call.

- [ ] **Step 2: Run the test**

Run: `pnpm --filter api exec node ./scripts/run-jest.mjs src/qc/qc.registry-zero-ward.spec.ts`

Expected: PASS. This locks current list behavior. If the row shape is missing a required field, add that field from the `listRegistry` mapper. Do not add `ward: { deletedAt: null }` to the query.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/qc/qc.registry-zero-ward.spec.ts
git commit -m "test: keep surveys on a soft-deleted Zero Ward in the QC list"
```

---

### Task 7: Geography screen

**Files:**

- Modify: `apps/web/features/configuration/components/GeographyAccordion.tsx`
- Modify: `apps/web/features/configuration/components/GeoDrawers.tsx`
- Modify: `apps/web/features/master-data/panels/tenants-wards-panel.tsx`

**Interfaces:**

- Consumes: `POST /ulbs/:ulbId/zero-ward` from Task 2. `isSystemZeroWard` from `@workspace/validation`.
- Produces: a **Create Zero Ward** button hidden when the loaded ward list contains an active system Zero Ward, and a delete dialog that soft-deletes that ward.

- [ ] **Step 1: Thread the callback**

Add `onCreateZeroWard: (ulb: GeographyTreeNode) => void` to `GeographyAccordion`, `StateCard`, `DistrictCard`, and `UlbCard`. Pass it through each call.

In `UlbCard`, next to **Add ward**, render this button only when `canManage` is true and the loaded wards do not include an active system Zero Ward:

```tsx
const hasActiveZeroWard = wards.some((ward) => isSystemZeroWard({ kind: ward.kind, wardName: ward.name }))
```

```tsx
{
  canManage && !hasActiveZeroWard ? (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 cursor-pointer text-xs"
      onClick={() => onCreateZeroWard(ulb)}
    >
      <Plus className="size-3.5" />
      Create Zero Ward
    </Button>
  ) : null
}
```

Do not filter the Zero Ward out of `WardPillGrid`.

- [ ] **Step 2: Call the endpoint and unblock delete**

In `tenants-wards-panel.tsx`, remove `ZERO_WARD_DELETE_BLOCKED`, the early return in `confirmDelete` that skips system Zero Wards, and set `wardDeleteBlocked` to `null`.

Pass:

```tsx
onCreateZeroWard={(ulb) => {
  void (async () => {
    try {
      await apiPost(`/ulbs/${ulb.id}/zero-ward`)
      toast.success("Zero Ward created")
      await queryClient.invalidateQueries({ queryKey: ["configuration", "geography-ulb-wards", ulb.id] })
      await invalidate()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  })()
}}
```

Use the panel's existing `invalidate` and `queryClient`.

- [ ] **Step 3: Reject reserved values in the Add Ward drawer**

In `WardDrawer` `onSubmit`, before the duplicate-name check, when `mode === "create"`:

```ts
import { isZeroWardName, normalizeWardNumber } from "@workspace/validation"

if (normalizeWardNumber(wardNumber) === "0") {
  onNameErrorChange?.("Ward number 0 is reserved for Zero Ward. Use Create Zero Ward.")
  return
}
if (isZeroWardName(wardName)) {
  onNameErrorChange?.("The name Zero Ward is reserved. Use Create Zero Ward.")
  return
}
```

Number is checked first. Leave edit mode able to open a Zero Ward so the admin can delete it. The API still rejects number and name changes.

- [ ] **Step 4: Typecheck the web app**

Run: `pnpm --filter web typecheck`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/configuration/components/GeographyAccordion.tsx apps/web/features/configuration/components/GeoDrawers.tsx apps/web/features/master-data/panels/tenants-wards-panel.tsx
git commit -m "feat: let an admin create and soft-delete the Zero Ward"
```

---

### Task 8: Full API verification

- [ ] **Step 1: Run the affected API tests**

Run:

```bash
pnpm --filter api exec node ./scripts/run-jest.mjs src/common/services/zero-ward.service.spec.ts src/wards/wards.repository.spec.ts src/common/services/ward-catalog.service.spec.ts src/qc/qc.quarantine.spec.ts src/qc/qc.registry-zero-ward.spec.ts src/ulbs/ulbs.repository.spec.ts
```

Expected: PASS, including the existing ULB delete cases.

- [ ] **Step 2: Search for leftover auto-create**

Run: `rg ensureZeroWard apps packages`

Expected: no matches.
