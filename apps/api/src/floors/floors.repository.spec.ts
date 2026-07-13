import { jest } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import { FloorPosition } from "@workspace/database"
import { FloorsRepository } from "./floors.repository.js"

describe("FloorsRepository duplicate floor", () => {
  const prisma = {
    db: {
      floor: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    },
  }

  const repo = new FloorsRepository(prisma as never)

  it("throws on duplicate floor position", async () => {
    prisma.db.floor.findFirst.mockResolvedValue({ id: "existing" })
    await expect(
      repo.create({
        surveyId: "s1",
        floorPosition: FloorPosition.GROUND_FLOOR,
        areaSqFt: 100,
      })
    ).rejects.toThrow(BadRequestException)
  })
})
