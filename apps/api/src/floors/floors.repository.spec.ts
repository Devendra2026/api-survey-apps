import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import { FloorPosition, UsageFactor } from "@workspace/database"
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
      // assertAreasWithinPlot + recalculateAreas each call findMany
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
    jest.clearAllMocks()
    surveyFindUnique.mockResolvedValue({ plotAreaSqFt: 1000 })
  })

  it("throws when usage factor is missing", async () => {
    await expect(
      repo.create({
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        areaSqFt: 100,
      } as never)
    ).rejects.toThrow(BadRequestException)
  })

  it("throws on duplicate floor position + usage factor", async () => {
    findFirst.mockResolvedValue({ id: "existing" })
    await expect(
      repo.create({
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.RESIDENTIAL,
        areaSqFt: 100,
      })
    ).rejects.toThrow(/Duplicate floor usage/)
  })

  it("allows same floor position with a different usage factor within plot", async () => {
    findFirst.mockResolvedValue(null)
    mockSuccessfulCreateTx(
      {
        id: "f2",
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.COMMERCIAL,
        areaSqFt: 300,
      },
      [{ floorPosition: FloorPosition.GROUND_FLOOR, areaSqFt: 300, usageFactor: UsageFactor.RESIDENTIAL }]
    )

    const result = await repo.create({
      surveyId: "s1",
      floorPosition: FloorPosition.GROUND_FLOOR,
      usageFactor: UsageFactor.COMMERCIAL,
      areaSqFt: 300,
    })
    expect(result.id).toBe("f2")
  })

  it("rejects when mixed usages on the same floor exceed plot area", async () => {
    findFirst.mockResolvedValue(null)
    surveyFindUnique.mockResolvedValue({ plotAreaSqFt: 600 })
    transaction.mockImplementation(async (fn: unknown) => {
      const run = fn as (tx: {
        floor: { create: typeof create; findMany: typeof findMany }
        survey: { findUnique: typeof surveyFindUnique; update: typeof surveyUpdate }
      }) => Promise<unknown>
      findMany.mockResolvedValue([{ floorPosition: FloorPosition.GROUND_FLOOR, areaSqFt: 300 }] as never)
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
        areaSqFt: 350,
      })
    ).rejects.toThrow(/Total area on this floor exceeds plot area/)
  })

  it("rejects when survey-wide floor areas exceed plot area", async () => {
    findFirst.mockResolvedValue(null)
    surveyFindUnique.mockResolvedValue({ plotAreaSqFt: 1000 })
    transaction.mockImplementation(async (fn: unknown) => {
      const run = fn as (tx: {
        floor: { create: typeof create; findMany: typeof findMany }
        survey: { findUnique: typeof surveyFindUnique; update: typeof surveyUpdate }
      }) => Promise<unknown>
      findMany.mockResolvedValue([
        { floorPosition: FloorPosition.GROUND_FLOOR, areaSqFt: 600 },
        { floorPosition: FloorPosition.FIRST_FLOOR, areaSqFt: 400 },
      ] as never)
      return run({
        floor: { create, findMany },
        survey: { findUnique: surveyFindUnique, update: surveyUpdate },
      })
    })

    await expect(
      repo.create({
        surveyId: "s1",
        floorPosition: FloorPosition.SECOND_FLOOR,
        usageFactor: UsageFactor.RESIDENTIAL,
        areaSqFt: 50,
      })
    ).rejects.toThrow(/Total floor area exceeds plot area/)
  })

  it("skips plot hard-check when plot area is unset", async () => {
    findFirst.mockResolvedValue(null)
    surveyFindUnique.mockResolvedValue({ plotAreaSqFt: null })
    mockSuccessfulCreateTx({
      id: "f3",
      surveyId: "s1",
      floorPosition: FloorPosition.GROUND_FLOOR,
      usageFactor: UsageFactor.RESIDENTIAL,
      areaSqFt: 5000,
    })

    const result = await repo.create({
      surveyId: "s1",
      floorPosition: FloorPosition.GROUND_FLOOR,
      usageFactor: UsageFactor.RESIDENTIAL,
      areaSqFt: 5000,
    })
    expect(result.id).toBe("f3")
  })

  it("maps Prisma P2002 unique conflicts to BadRequestException", async () => {
    findFirst.mockResolvedValue(null)
    transaction.mockRejectedValue({ code: "P2002", meta: { target: ["surveyId", "floorPosition", "usageFactor"] } })

    await expect(
      repo.create({
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.RESIDENTIAL,
        areaSqFt: 100,
      })
    ).rejects.toThrow(/Duplicate floor usage: GROUND_FLOOR \+ RESIDENTIAL/)
  })
})
