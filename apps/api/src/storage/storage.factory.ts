import { ConfigService } from "@nestjs/config"
import { AwsS3StorageService } from "./aws-s3.storage.service.js"
import { MinioStorageService } from "./minio.storage.service.js"
import type { StorageService } from "./storage.types.js"
import { StorageProvider } from "./storage.types.js"

export function createStorageService(configService: ConfigService): StorageService {
  const provider = configService.get<string>("STORAGE_PROVIDER")?.trim().toLowerCase()

  if (provider === "minio") {
    return new MinioStorageService(configService)
  }

  if (provider && provider !== "s3") {
    throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`)
  }

  return new AwsS3StorageService(configService)
}

export function selectedStorageProvider(configService: ConfigService) {
  const provider = configService.get<string>("STORAGE_PROVIDER")?.trim().toLowerCase()
  return provider === "minio" ? StorageProvider.MINIO : StorageProvider.S3
}
