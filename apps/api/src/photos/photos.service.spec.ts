import { NotFoundException } from "@nestjs/common"
import { PhotosRepository } from "./photos.repository.js"
import { PhotosService } from "./photos.service.js"
import { StorageService } from "../storage/storage.service.js"
import { SurveysService } from "../surveys/surveys.service.js"

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
