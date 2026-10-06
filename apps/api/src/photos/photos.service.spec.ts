import { jest } from "@jest/globals"
import { NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import { PhotoType } from "@workspace/database"
import { StorageService } from "../storage/storage.service.js"
import { SurveysService } from "../surveys/surveys.service.js"
import { PhotosRepository } from "./photos.repository.js"
import { PhotosService } from "./photos.service.js"

describe("PhotosService download URLs", () => {
  it("authorizes the survey before issuing a short-lived signed URL", async () => {
    const readableSurveyCalls: Array<[string, { id: string }]> = []
    const signedUrlCalls: Array<[string, number]> = []
    const photosRepository = {
      findById: () =>
        Promise.resolve({
          id: "photo-1",
          surveyId: "survey-1",
          objectKey: "uploads/state/district/ulb/ward/survey/survey-1/photo.jpg",
        }),
    } as unknown as PhotosRepository
    const surveysService = {
      assertReadableSurvey: (surveyId: string, user: { id: string }) => {
        readableSurveyCalls.push([surveyId, user])
        return Promise.resolve(undefined)
      },
    } as unknown as SurveysService
    const storageService = {
      getPresignedDownloadUrl: (key: string, expiresInSeconds: number) => {
        signedUrlCalls.push([key, expiresInSeconds])
        return Promise.resolve("https://storage.example.com/signed-photo")
      },
    } as unknown as StorageService
    const service = new PhotosService(photosRepository, surveysService, storageService)

    await expect(service.getDownloadUrl("photo-1", { id: "user-1" } as never, 300)).resolves.toEqual({
      photoId: "photo-1",
      url: "https://storage.example.com/signed-photo",
      expiresInSeconds: 300,
    })
    expect(readableSurveyCalls).toEqual([["survey-1", { id: "user-1" }]])
    expect(signedUrlCalls).toEqual([["uploads/state/district/ulb/ward/survey/survey-1/photo.jpg", 300]])
  })

  it("presigns a storage-key url when objectKey is null", async () => {
    const photosRepository = {
      findById: () =>
        Promise.resolve({
          id: "photo-1",
          surveyId: "survey-1",
          objectKey: null,
          url: "etah-images/district-05/ward-12/legacy/front.jpg",
          sourceUrl: null,
        }),
    } as unknown as PhotosRepository
    const surveysService = {
      assertReadableSurvey: () => Promise.resolve(undefined),
    } as unknown as SurveysService
    const storageService = {
      getPresignedDownloadUrl: (key: string) => Promise.resolve(`https://signed/${key}`),
    } as unknown as StorageService
    const service = new PhotosService(photosRepository, surveysService, storageService)

    await expect(service.getDownloadUrl("photo-1", { id: "user-1" } as never)).resolves.toEqual({
      photoId: "photo-1",
      url: "https://signed/etah-images/district-05/ward-12/legacy/front.jpg",
      expiresInSeconds: 900,
    })
  })
})

describe("PhotosService getFileStream", () => {
  it("streams from url when objectKey is null", async () => {
    const photosRepository = {
      findById: () =>
        Promise.resolve({
          id: "photo-1",
          surveyId: "survey-1",
          objectKey: null,
          url: "etah-images/district-05/ward-12/legacy/front.jpg",
          mimeType: "image/jpeg",
        }),
      update: () => Promise.resolve({}),
    } as unknown as PhotosRepository
    const surveysService = {
      assertReadableSurvey: () => Promise.resolve(undefined),
    } as unknown as SurveysService
    const storageService = {
      getObjectStream: (key: string) =>
        Promise.resolve({
          body: { pipe: () => undefined },
          contentType: "image/jpeg",
          contentLength: 12,
          key,
        }),
    } as unknown as StorageService
    const service = new PhotosService(photosRepository, surveysService, storageService)

    const file = await service.getFileStream("photo-1", { id: "user-1" } as never)
    expect(file.contentType).toBe("image/jpeg")
    expect(file.contentLength).toBe(12)
  })

  it("tries sibling extensions when the stored key is missing", async () => {
    const tried: string[] = []
    const photosRepository = {
      findById: () =>
        Promise.resolve({
          id: "photo-1",
          surveyId: "survey-1",
          objectKey: "etah-images/district-05/ward-12/legacy/front.webp",
          mimeType: "image/webp",
        }),
      update: () => Promise.resolve({}),
    } as unknown as PhotosRepository
    const surveysService = {
      assertReadableSurvey: () => Promise.resolve(undefined),
    } as unknown as SurveysService
    const storageService = {
      getObjectStream: (key: string) => {
        tried.push(key)
        if (key.endsWith(".webp")) {
          const err = Object.assign(new Error("The specified key does not exist."), { name: "NoSuchKey" })
          return Promise.reject(err)
        }
        return Promise.resolve({
          body: { pipe: () => undefined },
          contentType: "image/jpeg",
          contentLength: 40,
        })
      },
    } as unknown as StorageService
    const service = new PhotosService(photosRepository, surveysService, storageService)

    const file = await service.getFileStream("photo-1", { id: "user-1" } as never)
    expect(tried[0]).toBe("etah-images/district-05/ward-12/legacy/front.webp")
    expect(tried[1]).toBe("etah-images/district-05/ward-12/legacy/front.jpg")
    expect(file.contentType).toBe("image/jpeg")
  })

  it("returns 404 when no sibling object exists", async () => {
    const photosRepository = {
      findById: () =>
        Promise.resolve({
          id: "photo-1",
          surveyId: "survey-1",
          objectKey: "etah-images/district-05/ward-12/legacy/front.webp",
        }),
    } as unknown as PhotosRepository
    const surveysService = {
      assertReadableSurvey: () => Promise.resolve(undefined),
    } as unknown as SurveysService
    const storageService = {
      getObjectStream: () => {
        const err = Object.assign(new Error("The specified key does not exist."), { name: "NoSuchKey" })
        return Promise.reject(err)
      },
    } as unknown as StorageService
    const service = new PhotosService(photosRepository, surveysService, storageService)

    await expect(service.getFileStream("photo-1", { id: "user-1" } as never)).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe("PhotosService replace", () => {
  const file = { buffer: Buffer.from("jpeg"), mimetype: "image/jpeg", originalname: "front.jpg" } as Express.Multer.File
  const user = { id: "user-1" } as never

  function createService(options?: { deleteOld?: boolean; updateError?: Error }) {
    const deleted: string[] = []
    const create = jest.fn(() => Promise.reject(new Error("replace must not create a row")))
    const photosRepository = {
      findById: () =>
        Promise.resolve({
          id: "photo-1",
          surveyId: "survey-1",
          photoType: PhotoType.FRONT,
          objectKey: "uploads/front-old.jpg",
        }),
      update: () => {
        if (options?.updateError) return Promise.reject(options.updateError)
        return Promise.resolve({
          id: "photo-1",
          surveyId: "survey-1",
          photoType: PhotoType.FRONT,
          objectKey: "uploads/front-new.jpg",
        })
      },
      create,
      delete: jest.fn(() => Promise.resolve({ id: "photo-1" })),
    } as unknown as PhotosRepository
    const surveysService = {
      assertEditableSurvey: () =>
        Promise.resolve({
          stateId: "state",
          districtId: "district",
          ulbId: "ulb",
          wardId: "ward",
        }),
    } as unknown as SurveysService
    const storageService = {
      uploadImage: () =>
        Promise.resolve({
          key: "uploads/front-new.jpg",
          url: "https://storage.example/front-new.jpg",
          bucket: "photos",
          provider: "minio",
          sizeBytes: 4,
          sizeKB: 1,
          mimeType: "image/jpeg",
          checksum: "abc",
          etag: "etag",
        }),
      deleteObject: (key: string) => {
        deleted.push(key)
        if (key === "uploads/front-old.jpg" && options?.deleteOld === false) {
          return Promise.resolve({ deleted: false })
        }
        return Promise.resolve({ deleted: true })
      },
    } as unknown as StorageService
    return { service: new PhotosService(photosRepository, surveysService, storageService), deleted, create }
  }

  it("replaces the existing FRONT row and removes the previous object", async () => {
    const { service, deleted, create } = createService()
    const photo = await service.replace("photo-1", file, user, { photoType: PhotoType.FRONT })
    expect(photo.id).toBe("photo-1")
    expect(photo.objectKey).toBe("uploads/front-new.jpg")
    expect(deleted).toEqual(["uploads/front-old.jpg"])
    expect(create).not.toHaveBeenCalled()
  })

  it("keeps the updated row when cleanup of the old object fails", async () => {
    const { service } = createService({ deleteOld: false })
    await expect(service.replace("photo-1", file, user, { photoType: PhotoType.FRONT })).resolves.toMatchObject({
      id: "photo-1",
      objectKey: "uploads/front-new.jpg",
    })
  })

  it("removes the new object when the database update fails", async () => {
    const { service, deleted } = createService({ updateError: new Error("db down") })
    await expect(service.replace("photo-1", file, user)).rejects.toThrow("db down")
    expect(deleted).toEqual(["uploads/front-new.jpg"])
  })

  it("leaves the database row in place when storage deletion fails", async () => {
    const deletePhoto = jest.fn(() => Promise.resolve({ id: "photo-1" }))
    const photosRepository = {
      findById: () =>
        Promise.resolve({
          id: "photo-1",
          surveyId: "survey-1",
          photoType: PhotoType.SIDE,
          objectKey: "uploads/side.jpg",
          url: "uploads/side.jpg",
        }),
      delete: deletePhoto,
    } as unknown as PhotosRepository
    const surveysService = {
      assertEditableSurvey: () => Promise.resolve({}),
    } as unknown as SurveysService
    const storageService = {
      deleteObject: () => Promise.resolve({ deleted: false }),
    } as unknown as StorageService
    const service = new PhotosService(photosRepository, surveysService, storageService)
    await expect(service.delete("photo-1", user)).rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(deletePhoto).not.toHaveBeenCalled()
  })
})
