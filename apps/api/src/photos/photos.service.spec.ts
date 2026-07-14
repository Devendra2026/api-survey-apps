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
    const downloadService = service as unknown as {
      getDownloadUrl(id: string, user: { id: string }, expiresInSeconds?: number): Promise<unknown>
    }

    await expect(downloadService.getDownloadUrl("photo-1", { id: "user-1" }, 300)).resolves.toEqual({
      photoId: "photo-1",
      url: "https://storage.example.com/signed-photo",
      expiresInSeconds: 300,
    })
    expect(readableSurveyCalls).toEqual([["survey-1", { id: "user-1" }]])
    expect(signedUrlCalls).toEqual([["uploads/state/district/ulb/ward/survey/survey-1/photo.jpg", 300]])
  })
})
