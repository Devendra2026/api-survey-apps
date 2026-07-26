import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ConflictException } from "@nestjs/common"
import { DistrictsRepository } from "./districts.repository.js"

describe("DistrictsRepository", () => {
  const district = {
    create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    findFirst: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    count: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    delete: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
  }

  const prisma = { db: { district } }
  let repo: DistrictsRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repo = new DistrictsRepository(prisma as never)
  })

  it("normalizes code on create", async () => {
    district.create.mockResolvedValue({ id: "d1", code: "BAG", name: "Baghpat", stateId: "s1" })
    await repo.create({ stateId: "s1", name: "Baghpat", code: "bag" })
    expect(district.create).toHaveBeenCalledWith({
      data: { stateId: "s1", name: "Baghpat", code: "BAG" },
    })
  })

  it("maps unique code conflicts to ConflictException", async () => {
    district.create.mockRejectedValue({ code: "P2002", meta: { target: ["stateId", "code"] } })
    await expect(repo.create({ stateId: "s1", name: "Baghpat", code: "BAG" })).rejects.toBeInstanceOf(ConflictException)
    await expect(repo.create({ stateId: "s1", name: "Baghpat", code: "BAG" })).rejects.toThrow(
      /District code already exists in this state/
    )
  })
})
