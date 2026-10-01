import { describe, expect, it, jest } from "@jest/globals"
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

describe("listUnresolvedQuarantineSurveys", () => {
  it("lists Zero Ward surveys with no original ward and does not guess identity", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "s1",
        propertyId: "800726-012-00010-001-R",
        parcelNumber: "00010",
        unitSubNo: "001",
        surveyStatus: "SUBMITTED",
        wardId: "zero",
        wardNumber: "12",
      },
    ] as never)
    const rows = await listUnresolvedQuarantineSurveys({ survey: { findMany } } as never, "ulb-a")
    expect(rows).toEqual([
      {
        id: "s1",
        propertyId: "800726-012-00010-001-R",
        parcelNumber: "00010",
        unitSubNo: "001",
        surveyStatus: "SUBMITTED",
        currentWardId: "zero",
        storedWardNumber: "12",
      },
    ])
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ originalWardId: null, ulbId: "ulb-a" }),
      })
    )
  })
})
