import { describe, expect, it, jest } from "@jest/globals"
import {
  isConvexHostedUrl,
  isMissingObjectError,
  refreshSurveyPhotoUrls,
  resolveStoredObjectKey,
  siblingObjectKeys,
} from "./survey-photo-urls.js"

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

describe("resolveStoredObjectKey", () => {
  it("prefers objectKey when it is a storage path", () => {
    expect(
      resolveStoredObjectKey({
        objectKey: "etah-images/district-05/ward-12/legacy/front.jpg",
        url: "uploads/other",
      })
    ).toBe("etah-images/district-05/ward-12/legacy/front.jpg")
  })

  it("uses url when objectKey is null and url is a storage key", () => {
    expect(
      resolveStoredObjectKey({
        objectKey: null,
        url: "etah-images/district-05/ward-12/legacy/front.jpg",
      })
    ).toBe("etah-images/district-05/ward-12/legacy/front.jpg")
  })

  it("does not treat Convex HTTPS as a storage key", () => {
    expect(
      resolveStoredObjectKey({
        objectKey: null,
        url: "https://happy-animal-123.convex.cloud/api/storage/abc",
        sourceUrl: "https://happy-animal-123.convex.cloud/api/storage/abc",
      })
    ).toBeNull()
  })
})

describe("siblingObjectKeys", () => {
  it("keeps the original key first and tries other image extensions", () => {
    expect(siblingObjectKeys("etah-images/district-05/ward-12/legacy/front.webp")).toEqual([
      "etah-images/district-05/ward-12/legacy/front.webp",
      "etah-images/district-05/ward-12/legacy/front.jpg",
      "etah-images/district-05/ward-12/legacy/front.jpeg",
      "etah-images/district-05/ward-12/legacy/front.png",
      "etah-images/district-05/ward-12/legacy/front.heic",
    ])
  })
})

describe("isMissingObjectError", () => {
  it("detects S3 NoSuchKey and 404 metadata", () => {
    expect(isMissingObjectError({ name: "NoSuchKey" })).toBe(true)
    expect(isMissingObjectError({ $metadata: { httpStatusCode: 404 } })).toBe(true)
    expect(isMissingObjectError(new Error("Object not found: key"))).toBe(true)
    expect(isMissingObjectError(new Error("AccessDenied"))).toBe(false)
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

  it("presigns a storage-key url when objectKey is null", async () => {
    const storage = {
      isConfigured: () => true,
      getPresignedDownloadUrl: jest.fn(() => Promise.resolve("https://signed.example/photo.jpg")),
    }
    const result = await refreshSurveyPhotoUrls(
      storage as never,
      photoDetail({ url: "etah-images/district-05/ward-12/legacy/front.jpg", objectKey: null }),
      [
        {
          id: "p1",
          objectKey: null,
          sourceUrl: null,
          url: "etah-images/district-05/ward-12/legacy/front.jpg",
          importStatus: "SUCCEEDED",
        },
      ]
    )

    expect(result.photos[0]?.url).toBe("https://signed.example/photo.jpg")
    expect(result.photos[0]?.objectKey).toBe("etah-images/district-05/ward-12/legacy/front.jpg")
    expect(storage.getPresignedDownloadUrl).toHaveBeenCalledWith(
      "etah-images/district-05/ward-12/legacy/front.jpg",
      3600
    )
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

  it("never returns a bare storage key as url when storage is not configured", async () => {
    const storage = {
      isConfigured: () => false,
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
    expect(result.photos[0]?.objectKey).toBe("uploads/migrated-key")
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
