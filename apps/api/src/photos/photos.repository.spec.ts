import { jest } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import { PhotoType } from "@workspace/database"
import { PhotosRepository } from "./photos.repository.js"

describe("PhotosRepository FRONT uniqueness", () => {
  function createRepository() {
    const order: string[] = []
    const findFirst = jest.fn<(...args: unknown[]) => Promise<unknown>>()
    const create = jest.fn<(...args: unknown[]) => Promise<unknown>>()
    const tx = {
      $queryRaw: jest.fn(() => {
        order.push("lock")
        return Promise.resolve([])
      }),
      photo: { findFirst, create },
    }
    const prisma = {
      db: {
        $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      },
    }
    return { repo: new PhotosRepository(prisma as never), findFirst, create, order }
  }

  it("locks the survey row and blocks a second FRONT photo", async () => {
    const { repo, findFirst, create, order } = createRepository()
    findFirst.mockImplementation(() => {
      order.push("check")
      return Promise.resolve({ id: "p1", photoType: PhotoType.FRONT })
    })
    await expect(
      repo.create({
        surveyId: "s1",
        photoType: PhotoType.FRONT,
        url: "https://cdn.example.com/front.jpg",
      })
    ).rejects.toThrow(BadRequestException)
    expect(create).not.toHaveBeenCalled()
    expect(order).toEqual(["lock", "check"])
  })

  it("inserts a FRONT photo only after the survey row lock", async () => {
    const { repo, findFirst, create, order } = createRepository()
    findFirst.mockImplementation(() => {
      order.push("check")
      return Promise.resolve(null)
    })
    create.mockImplementation(() => {
      order.push("insert")
      return Promise.resolve({ id: "p2" })
    })
    await expect(
      repo.create({
        surveyId: "s1",
        photoType: PhotoType.FRONT,
        url: "https://cdn.example.com/front.jpg",
      })
    ).resolves.toEqual({ id: "p2" })
    expect(order).toEqual(["lock", "check", "insert"])
  })
})
