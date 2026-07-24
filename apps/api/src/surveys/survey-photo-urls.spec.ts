import { describe, expect, it, jest } from "@jest/globals"
import { refreshSurveyPhotoUrls } from "./survey-photo-urls.js"

describe("refreshSurveyPhotoUrls", () => {
  it("prefers https sourceUrl over objectKey for browser-safe display", async () => {
    const storage = {
      isConfigured: () => true,
      getPresignedDownloadUrl: jest.fn(() => Promise.resolve("https://signed.example/photo.jpg")),
    }
    const detail = {
      photos: [
        {
          id: "p1",
          photoType: "FRONT",
          label: "Front",
          url: "uploads/old-key",
          capturedAt: null,
          surveyorName: "A",
          importStatus: "SUCCEEDED",
        },
      ],
      frontPhotoUrl: "uploads/old-key",
      sidePhotoUrl: null as string | null,
    }

    const result = await refreshSurveyPhotoUrls(storage as never, detail, [
      { id: "p1", objectKey: "uploads/real-key", sourceUrl: "https://cdn.example/a.jpg", importStatus: "SUCCEEDED" },
    ])

    expect(result.photos[0]?.url).toBe("https://cdn.example/a.jpg")
    expect(result.frontPhotoUrl).toBe("https://cdn.example/a.jpg")
    expect(storage.getPresignedDownloadUrl).not.toHaveBeenCalled()
  })

  it("presigns when objectKey is present and no https sourceUrl", async () => {
    const storage = {
      isConfigured: () => true,
      getPresignedDownloadUrl: jest.fn(() => Promise.resolve("https://signed.example/photo.jpg")),
    }
    const detail = {
      photos: [
        {
          id: "p1",
          photoType: "FRONT",
          label: "Front",
          url: "uploads/old-key",
          capturedAt: null,
          surveyorName: "A",
          importStatus: "SUCCEEDED",
        },
      ],
      frontPhotoUrl: "uploads/old-key",
      sidePhotoUrl: null as string | null,
    }

    const result = await refreshSurveyPhotoUrls(storage as never, detail, [
      { id: "p1", objectKey: "uploads/real-key", sourceUrl: null, importStatus: "SUCCEEDED" },
    ])

    expect(result.photos[0]?.url).toBe("https://signed.example/photo.jpg")
    expect(storage.getPresignedDownloadUrl).toHaveBeenCalled()
  })

  it("falls back to https sourceUrl when objectKey missing", async () => {
    const storage = {
      isConfigured: () => true,
      getPresignedDownloadUrl: jest.fn(),
    }
    const detail = {
      photos: [
        {
          id: "p1",
          photoType: "FRONT",
          label: "Front",
          url: "https://cdn.example/pending.jpg",
          capturedAt: null,
          surveyorName: "A",
          importStatus: "PENDING",
        },
      ],
      frontPhotoUrl: "https://cdn.example/pending.jpg",
      sidePhotoUrl: null as string | null,
    }

    const result = await refreshSurveyPhotoUrls(storage as never, detail, [
      {
        id: "p1",
        objectKey: null,
        sourceUrl: "https://cdn.example/pending.jpg",
        url: "https://cdn.example/pending.jpg",
        importStatus: "PENDING",
      },
    ])

    expect(result.photos[0]?.url).toBe("https://cdn.example/pending.jpg")
    expect(storage.getPresignedDownloadUrl).not.toHaveBeenCalled()
  })

  it("never returns a bare storage key as url", async () => {
    const storage = {
      isConfigured: () => true,
      getPresignedDownloadUrl: jest.fn(),
    }
    const detail = {
      photos: [
        {
          id: "p1",
          photoType: "SIDE",
          label: "Side",
          url: "uploads/migrated-key",
          capturedAt: null,
          surveyorName: "A",
          importStatus: "SUCCEEDED",
        },
      ],
      frontPhotoUrl: null as string | null,
      sidePhotoUrl: "uploads/migrated-key",
    }

    const result = await refreshSurveyPhotoUrls(storage as never, detail, [
      { id: "p1", objectKey: null, sourceUrl: null, url: "uploads/migrated-key", importStatus: "SUCCEEDED" },
    ])

    expect(result.photos[0]?.url).toBe("")
  })

  it("still falls back to https when storage is not configured", async () => {
    const storage = {
      isConfigured: () => false,
      getPresignedDownloadUrl: jest.fn(),
    }
    const detail = {
      photos: [
        {
          id: "p1",
          photoType: "FRONT",
          label: "Front",
          url: "https://cdn.example/a.jpg",
          capturedAt: null,
          surveyorName: "A",
        },
      ],
      frontPhotoUrl: "https://cdn.example/a.jpg",
      sidePhotoUrl: null as string | null,
    }

    const result = await refreshSurveyPhotoUrls(storage as never, detail, [
      { id: "p1", objectKey: null, sourceUrl: "https://cdn.example/a.jpg", importStatus: "PENDING" },
    ])

    expect(result.photos[0]?.url).toBe("https://cdn.example/a.jpg")
    expect(result.photos[0]?.importStatus).toBe("PENDING")
  })
})
