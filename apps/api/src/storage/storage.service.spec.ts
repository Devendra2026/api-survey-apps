import { BadRequestException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { StorageService } from "./storage.service.js"
import { StorageProvider, type StorageService as StorageServicePort } from "./storage.types.js"

describe("StorageService MIME validation", () => {
  const service = new StorageService({
    get: (key: string) => {
      if (key === "AWS_S3_MAX_FILE_SIZE_BYTES") return 5 * 1024 * 1024
      return undefined
    },
  } as ConfigService, {
    isConfigured: () => true,
    uploadObject: async (input) => ({
      key: input.key,
      url: "https://signed.example.com/photo",
      bucket: "photos",
      provider: StorageProvider.S3,
      sizeBytes: input.body.byteLength,
      mimeType: input.mimeType,
    }),
    deleteObject: async () => undefined,
    getSignedDownloadUrl: async () => "https://signed.example.com/photo",
    getSignedUploadUrl: async () => "https://signed.example.com/upload",
    healthCheck: async () => ({ configured: true, healthy: true, provider: StorageProvider.S3, bucket: "photos" }),
  } satisfies StorageServicePort)

  it("rejects content whose magic bytes do not match the declared MIME type", () => {
    const fakeJpeg = Buffer.from("not-an-image")

    expect(() => service.validateImage("image/jpeg", fakeJpeg.byteLength, fakeJpeg)).toThrow(BadRequestException)
  })
})
