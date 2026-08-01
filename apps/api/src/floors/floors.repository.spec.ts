import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import { FloorPosition, UsageFactor } from "@workspace/database"
import { FloorsRepository } from "./floors.repository.js"

describe("FloorsRepository mixed-use floors", () => {
  const findFirst = jest.fn()
  const create = jest.fn()
  const findMany = jest.fn()
  const surveyUpdate = jest.fn()
  const transaction = jest.fn()

  const prisma = {
    db: {
      floor: {
        findFirst,
        findUnique: jest.fn(),
        create,
        findMany,
      },
      $transaction: transaction,
    },
  }

  const repo = new FloorsRepository(prisma as never)

  beforeEach(() => {
    jest.clearAllMocks()
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
    findFirst.mockResolvedValue({ id: "existing" } as never)
    await expect(
      repo.create({
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.RESIDENTIAL,
        areaSqFt: 100,
      })
    ).rejects.toThrow(/Duplicate floor usage/)
  })

  it("allows same floor position with a different usage factor", async () => {
    findFirst.mockResolvedValue(null as never)
    transaction.mockImplementation(async (fn: unknown) => {
      const run = fn as (tx: {
        floor: { create: typeof create; findMany: typeof findMany }
        survey: { update: typeof surveyUpdate }
      }) => Promise<unknown>
      return run({
        floor: {
          create: create.mockResolvedValue({
            id: "f2",
            surveyId: "s1",
            floorPosition: FloorPosition.GROUND_FLOOR,
            usageFactor: UsageFactor.COMMERCIAL,
          } as never),
          findMany: findMany.mockResolvedValue([] as never),
        },
        survey: { update: surveyUpdate },
      })
    })

    const result = await repo.create({
      surveyId: "s1",
      floorPosition: FloorPosition.GROUND_FLOOR,
      usageFactor: UsageFactor.COMMERCIAL,
      areaSqFt: 200,
    })
    expect(result.id).toBe("f2")
  })
})
