import { jest } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import { PhotoType } from "@workspace/database"
import { PhotosRepository } from "./photos.repository.js"

describe("PhotosRepository FRONT uniqueness", () => {
  const prisma = {
    db: {
      photo: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    },
  }

  const repo = new PhotosRepository(prisma as never)

  it("blocks second FRONT photo", async () => {
    prisma.db.photo.findFirst.mockResolvedValue({ id: "p1", photoType: PhotoType.FRONT })
    await expect(
      repo.create({
        surveyId: "s1",
        photoType: PhotoType.FRONT,
        url: "https://cdn.example.com/front.jpg",
      })
    ).rejects.toThrow(BadRequestException)
  })
})
