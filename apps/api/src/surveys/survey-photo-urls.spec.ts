import { describe, expect, it, jest } from "@jest/globals"
import { isConvexHostedUrl, refreshSurveyPhotoUrls } from "./survey-photo-urls.js"

function photoDetail(overrides?: { url?: string; importStatus?: string | null; objectKey?: string | null }) {
  return {
    photos: [
      {
        id: "p1",
        photoType: "FRONT",
        label: "Front",
        url: overrides?.url ?? "uploads/old-key",
        capturedAt: null,
        surveyorName: "A",
        importStatus: overrides?.importStatus ?? "SUCCEEDED",
        objectKey: overrides?.objectKey ?? null,
      },
    ],
    frontPhotoUrl: overrides?.url ?? "uploads/old-key",
    sidePhotoUrl: null as string | null,
  }
}

describe("isConvexHostedUrl", () => {
  it("detects convex.cloud and convex.site hosts", () => {
    expect(isConvexHostedUrl("https://happy-animal-123.convex.cloud/api/storage/abc")).toBe(true)
    expect(isConvexHostedUrl("https://site.convex.site/get?id=1")).toBe(true)
    expect(isConvexHostedUrl("https://cdn.example/a.jpg")).toBe(false)
  })
})

describe("refreshSurveyPhotoUrls", () => {
  it("presigns objectKey even when a Convex sourceUrl is present", async () => {
    const storage = {
      isConfigured: () => true,
      getPresignedDownloadUrl: jest.fn(() => Promise.resolve("https://signed.example/photo.jpg")),
    }
    const result = await refreshSurveyPhotoUrls(storage as never, photoDetail(), [
      {
        id: "p1",
        objectKey: "etah-images/district-05/ward-12/legacy/front.jpg",
        sourceUrl: "https://happy-animal-123.convex.cloud/api/storage/expired",
        importStatus: "SUCCEEDED",
      },
    ])

    expect(result.photos[0]?.url).toBe("https://signed.example/photo.jpg")
    expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith(
      "etah-images/district-05/ward-12/legacy/front.jpg",
      3600
    )
  })

  it("ignores Convex hosts when choosing an HTTPS fallback without objectKey", async () => {
    const storage = {
      isConfigured: () => true,
      getPresignedDownloadUrl: jest.fn(),
    }
    const result = await refreshSurveyPhotoUrls(
      storage as never,
      photoDetail({ url: "https://cdn.example/a.jpg", importStatus: "SUCCEEDED" }),
      [
        {
          id: "p1",
          objectKey: null,
          sourceUrl: "https://happy-animal-123.convex.cloud/api/storage/expired",
          url: "https://cdn.example/a.jpg",
          importStatus: "SUCCEEDED",
        },
      ]
    )

    expect(result.photos[0]?.url).toBe("https://cdn.example/a.jpg")
    expect(storage.getPresignedDownloadUrl).not.toHaveBeenCalled()
  })

  it("presigns when objectKey is present and no https sourceUrl", async () => {
    const storage = {
      isConfigured: () => true,
      getPresignedDownloadUrl: jest.fn(() => Promise.resolve("https://signed.example/photo.jpg")),
    }
    const result = await refreshSurveyPhotoUrls(storage as never, photoDetail(), [
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
    const result = await refreshSurveyPhotoUrls(
      storage as never,
      photoDetail({ url: "https://cdn.example/pending.jpg", importStatus: "PENDING" }),
      [
        {
          id: "p1",
          objectKey: null,
          sourceUrl: "https://cdn.example/pending.jpg",
          url: "https://cdn.example/pending.jpg",
          importStatus: "PENDING",
        },
      ]
    )

    expect(result.photos[0]?.url).toBe("https://cdn.example/pending.jpg")
    expect(storage.getPresignedDownloadUrl).not.toHaveBeenCalled()
  })

  it("uses Convex URL only as last resort when there is no objectKey", async () => {
    const storage = {
      isConfigured: () => true,
      getPresignedDownloadUrl: jest.fn(),
    }
    const convexUrl = "https://happy-animal-123.convex.cloud/api/storage/pending"
    const result = await refreshSurveyPhotoUrls(
      storage as never,
      photoDetail({ url: convexUrl, importStatus: "PENDING" }),
      [
        {
          id: "p1",
          objectKey: null,
          sourceUrl: convexUrl,
          url: convexUrl,
          importStatus: "PENDING",
        },
      ]
    )

    expect(result.photos[0]?.url).toBe(convexUrl)
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
          importStatus: "SUCCEEDED" as string | null,
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
    const result = await refreshSurveyPhotoUrls(
      storage as never,
      photoDetail({ url: "https://cdn.example/a.jpg", importStatus: null }),
      [{ id: "p1", objectKey: null, sourceUrl: "https://cdn.example/a.jpg", importStatus: "PENDING" }]
    )

    expect(result.photos[0]?.url).toBe("https://cdn.example/a.jpg")
    expect(result.photos[0]?.importStatus).toBe("PENDING")
  })
})
