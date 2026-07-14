import { ConfigService } from "@nestjs/config"
import { selectedStorageProvider } from "./storage.factory.js"
import { StorageProvider } from "./storage.types.js"

describe("storage provider selection", () => {
  it.each([
    ["minio", StorageProvider.MINIO],
    ["s3", StorageProvider.S3],
    [undefined, StorageProvider.S3],
  ])("selects %s as %s", (envProvider, expected) => {
    const config = {
      get: (key: string) => (key === "STORAGE_PROVIDER" ? envProvider : undefined),
    } as ConfigService

    expect(selectedStorageProvider(config)).toBe(expected)
  })
})
