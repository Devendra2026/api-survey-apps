import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import { ConstructionType, FloorPosition, UsageFactor } from "@workspace/database"
import { FloorsRepository } from "./floors.repository.js"

describe("FloorsRepository mixed-use floors", () => {
  const findFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const create = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const findMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const surveyFindUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const surveyUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const transaction = jest.fn<(...args: unknown[]) => Promise<unknown>>()

  const prisma = {
    db: {
      floor: {
        findFirst,
        findUnique: jest.fn(),
        create,
        findMany,
      },
      survey: {
        findUnique: surveyFindUnique,
        update: surveyUpdate,
      },
      $transaction: transaction,
    },
  }

  const repo = new FloorsRepository(prisma as never)

  function mockSuccessfulCreateTx(created: Record<string, unknown>, existingFloors: unknown[] = []) {
    transaction.mockImplementation(async (fn: unknown) => {
      const run = fn as (tx: {
        floor: { create: typeof create; findMany: typeof findMany }
        survey: { findUnique: typeof surveyFindUnique; update: typeof surveyUpdate }
      }) => Promise<unknown>
      // assertAreasWithinPlot + recalculateAreas each call findMany / findUnique
      findMany
        .mockResolvedValueOnce(existingFloors)
        .mockResolvedValueOnce([...(existingFloors as object[]), created] as never)
      return run({
        floor: {
          create: create.mockResolvedValue(created),
          findMany,
        },
        survey: {
          findUnique: surveyFindUnique,
          update: surveyUpdate,
        },
      })
    })
  }

  beforeEach(() => {
    jest.resetAllMocks()
    surveyFindUnique.mockResolvedValue({ plotAreaSqFt: 1000, propertyUse: "RESIDENTIAL", propertyType: null })
  })

  it("throws when usage factor is missing", async () => {
    await expect(
      repo.create({
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        areaSqFt: 100,
      } as never)
    ).rejects.toThrow(BadRequestException)
  })

  it("throws when construction type is missing", async () => {
    await expect(
      repo.create({
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.RESIDENTIAL,
        areaSqFt: 100,
      } as never)
    ).rejects.toThrow(/Construction type is required/)
  })

  it("throws on duplicate floor position + usage factor + construction type", async () => {
    findFirst.mockResolvedValue({ id: "existing" })
    await expect(
      repo.create({
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.RESIDENTIAL,
        constructionType: ConstructionType.TIN_SHED,
        areaSqFt: 100,
      })
    ).rejects.toThrow(/Duplicate floor usage: GROUND_FLOOR \+ RESIDENTIAL \+ TIN_SHED/)
  })

  it("allows same floor + same usage with different construction (Residential Pakka + Tin Shed)", async () => {
    findFirst.mockResolvedValue(null)
    mockSuccessfulCreateTx(
      {
        id: "f-tin",
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.RESIDENTIAL,
        constructionType: ConstructionType.TIN_SHED,
        areaSqFt: 400,
      },
      [
        {
          floorPosition: FloorPosition.GROUND_FLOOR,
          areaSqFt: 600,
          usageFactor: UsageFactor.RESIDENTIAL,
          constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        },
      ]
    )

    const result = await repo.create({
      surveyId: "s1",
      floorPosition: FloorPosition.GROUND_FLOOR,
      usageFactor: UsageFactor.RESIDENTIAL,
      constructionType: ConstructionType.TIN_SHED,
      areaSqFt: 400,
    })
    expect(result.id).toBe("f-tin")
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          floorPosition: FloorPosition.GROUND_FLOOR,
          usageFactor: UsageFactor.RESIDENTIAL,
          constructionType: ConstructionType.TIN_SHED,
        }),
      })
    )
  })

  it("allows same floor position with a different usage factor within plot", async () => {
    findFirst.mockResolvedValue(null)
    mockSuccessfulCreateTx(
      {
        id: "f2",
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.COMMERCIAL,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        areaSqFt: 300,
      },
      [
        {
          floorPosition: FloorPosition.GROUND_FLOOR,
          areaSqFt: 300,
          usageFactor: UsageFactor.RESIDENTIAL,
          constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        },
      ]
    )

    const result = await repo.create({
      surveyId: "s1",
      floorPosition: FloorPosition.GROUND_FLOOR,
      usageFactor: UsageFactor.COMMERCIAL,
      constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
      areaSqFt: 300,
    })
    expect(result.id).toBe("f2")
  })

  it("rejects when mixed usages on the same floor exceed plot area", async () => {
    findFirst.mockResolvedValue(null)
    surveyFindUnique.mockResolvedValue({ plotAreaSqFt: 600, propertyUse: "MIX_PROPERTY" })
    transaction.mockImplementation(async (fn: unknown) => {
      const run = fn as (tx: {
        floor: { create: typeof create; findMany: typeof findMany }
        survey: { findUnique: typeof surveyFindUnique; update: typeof surveyUpdate }
      }) => Promise<unknown>
      findMany.mockResolvedValue([
        {
          floorPosition: FloorPosition.GROUND_FLOOR,
          areaSqFt: 300,
          usageFactor: UsageFactor.RESIDENTIAL,
          constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        },
      ] as never)
      return run({
        floor: { create, findMany },
        survey: { findUnique: surveyFindUnique, update: surveyUpdate },
      })
    })

    await expect(
      repo.create({
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.COMMERCIAL,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        areaSqFt: 350,
      })
    ).rejects.toThrow(/Total area on this floor exceeds plot area/)
  })

  it("allows multi-story stacking when each floor is within plot", async () => {
    findFirst.mockResolvedValue(null)
    surveyFindUnique.mockResolvedValue({ plotAreaSqFt: 750, propertyUse: "RESIDENTIAL" })
    mockSuccessfulCreateTx(
      {
        id: "f6",
        surveyId: "s1",
        floorPosition: FloorPosition.SIXTH_FLOOR,
        usageFactor: UsageFactor.RESIDENTIAL,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        areaSqFt: 750,
      },
      [
        { floorPosition: FloorPosition.GROUND_FLOOR, areaSqFt: 750, usageFactor: UsageFactor.RESIDENTIAL },
        { floorPosition: FloorPosition.FIRST_FLOOR, areaSqFt: 750, usageFactor: UsageFactor.RESIDENTIAL },
        { floorPosition: FloorPosition.SECOND_FLOOR, areaSqFt: 750, usageFactor: UsageFactor.RESIDENTIAL },
        { floorPosition: FloorPosition.THIRD_FLOOR, areaSqFt: 750, usageFactor: UsageFactor.RESIDENTIAL },
        { floorPosition: FloorPosition.FOURTH_FLOOR, areaSqFt: 750, usageFactor: UsageFactor.RESIDENTIAL },
        { floorPosition: FloorPosition.FIFTH_FLOOR, areaSqFt: 750, usageFactor: UsageFactor.RESIDENTIAL },
      ]
    )

    const result = await repo.create({
      surveyId: "s1",
      floorPosition: FloorPosition.SIXTH_FLOOR,
      usageFactor: UsageFactor.RESIDENTIAL,
      constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
      areaSqFt: 750,
    })
    expect(result.id).toBe("f6")
  })

  it("rejects floor CRUD when property use is OPEN_LAND", async () => {
    findFirst.mockResolvedValue(null)
    surveyFindUnique.mockResolvedValue({ plotAreaSqFt: 750, propertyUse: "OPEN_LAND" })
    transaction.mockImplementation(async (fn: unknown) => {
      const run = fn as (tx: {
        floor: { create: typeof create; findMany: typeof findMany }
        survey: { findUnique: typeof surveyFindUnique; update: typeof surveyUpdate }
      }) => Promise<unknown>
      return run({
        floor: { create, findMany },
        survey: { findUnique: surveyFindUnique, update: surveyUpdate },
      })
    })

    await expect(
      repo.create({
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.RESIDENTIAL,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        areaSqFt: 100,
      })
    ).rejects.toThrow(/OPEN_LAND/)
  })

  it("ignores OPEN_LAND area when checking per-floor footprint", async () => {
    findFirst.mockResolvedValue(null)
    surveyFindUnique.mockResolvedValue({ plotAreaSqFt: 600, propertyUse: "RESIDENTIAL" })
    mockSuccessfulCreateTx(
      {
        id: "f4",
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.RESIDENTIAL,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        areaSqFt: 600,
      },
      [{ floorPosition: FloorPosition.OPEN_LAND, areaSqFt: 600, usageFactor: UsageFactor.OPEN_LAND }]
    )

    const result = await repo.create({
      surveyId: "s1",
      floorPosition: FloorPosition.GROUND_FLOOR,
      usageFactor: UsageFactor.RESIDENTIAL,
      constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
      areaSqFt: 600,
    })
    expect(result.id).toBe("f4")
  })

  it("skips plot hard-check when plot area is unset", async () => {
    findFirst.mockResolvedValue(null)
    surveyFindUnique.mockResolvedValue({ plotAreaSqFt: null, propertyUse: "RESIDENTIAL" })
    mockSuccessfulCreateTx({
      id: "f3",
      surveyId: "s1",
      floorPosition: FloorPosition.GROUND_FLOOR,
      usageFactor: UsageFactor.RESIDENTIAL,
      constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
      areaSqFt: 5000,
    })

    const result = await repo.create({
      surveyId: "s1",
      floorPosition: FloorPosition.GROUND_FLOOR,
      usageFactor: UsageFactor.RESIDENTIAL,
      constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
      areaSqFt: 5000,
    })
    expect(result.id).toBe("f3")
  })

  it("maps Prisma P2002 unique conflicts to BadRequestException", async () => {
    findFirst.mockResolvedValue(null)
    transaction.mockRejectedValue({
      code: "P2002",
      meta: { target: ["surveyId", "floorPosition", "usageFactor", "constructionType"] },
    })

    await expect(
      repo.create({
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.RESIDENTIAL,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        areaSqFt: 100,
      })
    ).rejects.toThrow(/Duplicate floor usage: GROUND_FLOOR \+ RESIDENTIAL \+ PAKKA_BUILDING_WITH_RCC_ROOF/)
  })
})
