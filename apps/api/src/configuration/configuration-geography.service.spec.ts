import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { WardKind } from "@workspace/database"
import { ZERO_WARD_NAME } from "@workspace/validation"
import { ConfigurationGeographyService } from "./configuration-geography.service.js"

describe("ConfigurationGeographyService ward counts", () => {
  const stateFindMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const wardGroupBy = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const surveyGroupBy = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const wardFindMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()

  const prisma = {
    db: {
      state: { findMany: stateFindMany },
      ward: { groupBy: wardGroupBy, findMany: wardFindMany },
      survey: { groupBy: surveyGroupBy },
    },
  }

  const stateRow = {
    id: "state-1",
    name: "Uttar Pradesh",
    code: "09",
    status: "ACTIVE",
    _count: { districts: 1, surveys: 0 },
    districts: [
      {
        id: "district-1",
        name: "Etah",
        code: "ETA",
        status: "ACTIVE",
        _count: { ulbs: 1, surveys: 0 },
        ulbs: [
          {
            id: "ulb-1",
            name: "Nagar Palika",
            code: "NGR",
            type: "MUNICIPAL_COUNCIL",
            status: "ACTIVE",
            _count: { wards: 1, surveys: 0 },
          },
        ],
      },
    ],
  }

  let service: ConfigurationGeographyService

  beforeEach(() => {
    stateFindMany.mockReset()
    wardGroupBy.mockReset()
    surveyGroupBy.mockReset()
    surveyGroupBy.mockResolvedValue([])
    wardFindMany.mockReset()
    service = new ConfigurationGeographyService(prisma as never)
  })

  it("counts only non-zero wards toward the ULB delete block", async () => {
    stateFindMany.mockResolvedValueOnce([stateRow])
    wardGroupBy.mockResolvedValueOnce([])

    const tree = await service.getTree()

    expect(wardGroupBy).toHaveBeenCalledWith({
      by: ["ulbId"],
      where: {
        deletedAt: null,
        kind: { not: WardKind.ZERO },
        NOT: { wardName: { equals: ZERO_WARD_NAME, mode: "insensitive" } },
      },
      _count: { _all: true },
    })
    const ulb = tree[0]?.children?.[0]?.children?.[0]
    expect(ulb?.counts).toEqual({ wards: 1, geographicWards: 0, surveys: 0 })
  })

  it("counts only surveys on active geographic wards toward the ULB delete block", async () => {
    stateFindMany.mockResolvedValueOnce([stateRow])
    wardGroupBy.mockResolvedValueOnce([])
    surveyGroupBy.mockResolvedValueOnce([{ ulbId: "ulb-1", _count: { _all: 2 } }])

    const tree = await service.getTree()

    expect(surveyGroupBy).toHaveBeenCalledWith({
      by: ["ulbId"],
      where: {
        deletedAt: null,
        ward: {
          deletedAt: null,
          kind: { not: WardKind.ZERO },
          NOT: { wardName: { equals: ZERO_WARD_NAME, mode: "insensitive" } },
        },
      },
      _count: { _all: true },
    })
    const ulb = tree[0]?.children?.[0]?.children?.[0]
    expect(ulb?.counts.surveys).toBe(2)
  })

  it("returns ward kind so the client can ignore the generated Zero Ward", async () => {
    wardFindMany.mockResolvedValueOnce([
      {
        id: "zero-1",
        wardNumber: "0",
        wardName: "Zero Ward",
        kind: "ZERO",
        status: "ACTIVE",
        ulbId: "ulb-1",
      },
    ])

    const wards = await service.listWardsForUlb("ulb-1")

    expect(wards).toEqual([
      expect.objectContaining({
        id: "zero-1",
        name: "Zero Ward",
        kind: "ZERO",
        wardNumber: "0",
      }),
    ])
  })
})
