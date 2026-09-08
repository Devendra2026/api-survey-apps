import { describe, expect, it, jest } from "@jest/globals"
import { ensureZeroWard, listUnresolvedQuarantineSurveys } from "./zero-ward.service.js"

describe("ensureZeroWard", () => {
  it("returns the existing Zero Ward for a ULB", async () => {
    const existing = {
      id: "z1",
      ulbId: "ulb-a",
      wardNumber: "0",
      wardName: "Zero Ward",
      kind: "ZERO" as const,
    }
    const findFirst = jest.fn().mockResolvedValue(existing as never)
    const create = jest.fn()
    const result = await ensureZeroWard(
      { ward: { findFirst, findMany: jest.fn(), update: jest.fn(), create } } as never,
      "ulb-a"
    )
    expect(result).toEqual(existing)
    expect(create).not.toHaveBeenCalled()
  })

  it("creates a distinct Zero Ward for each ULB", async () => {
    const created: string[] = []
    const db = {
      ward: {
        findFirst: jest.fn().mockResolvedValue(null as never),
        findMany: jest.fn().mockResolvedValue([] as never),
        update: jest.fn(),
        create: jest.fn(({ data }: { data: { ulbId: string } }) => {
          created.push(data.ulbId)
          return Promise.resolve({ id: `z-${data.ulbId}`, ...data, kind: "ZERO" })
        }),
      },
    }
    const a = await ensureZeroWard(db as never, "ulb-a")
    const b = await ensureZeroWard(db as never, "ulb-b")
    expect(a.ulbId).toBe("ulb-a")
    expect(b.ulbId).toBe("ulb-b")
    expect(a.id).not.toBe(b.id)
    expect(created).toEqual(["ulb-a", "ulb-b"])
  })

  it("adopts a uniquely named zero ward without creating another", async () => {
    const named = {
      id: "w12",
      ulbId: "ulb-a",
      wardNumber: "12",
      wardName: "zero ward",
      kind: "GEOGRAPHIC" as const,
    }
    const update = jest.fn().mockResolvedValue({ ...named, kind: "ZERO" } as never)
    const create = jest.fn()
    const result = await ensureZeroWard(
      {
        ward: {
          findFirst: jest.fn().mockResolvedValue(null as never),
          findMany: jest.fn().mockResolvedValue([named] as never),
          update,
          create,
        },
      } as never,
      "ulb-a"
    )
    expect(update).toHaveBeenCalledWith({ where: { id: "w12" }, data: { kind: "ZERO" } })
    expect(create).not.toHaveBeenCalled()
    expect(result.kind).toBe("ZERO")
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
