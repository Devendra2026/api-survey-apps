import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { S3CompatibleStorage } from "./s3-compatible.storage.js"
import { StorageProvider } from "./storage.types.js"

@Injectable()
export class MinioStorageService extends S3CompatibleStorage {
  constructor(configService: ConfigService) {
    const endpoint = nonEmpty(configService, "MINIO_ENDPOINT")
    const accessKeyId = nonEmpty(configService, "MINIO_ACCESS_KEY") ?? nonEmpty(configService, "MINIO_ROOT_USER")
    const secretAccessKey =
      nonEmpty(configService, "MINIO_SECRET_KEY") ?? nonEmpty(configService, "MINIO_ROOT_PASSWORD")
    const bucket = nonEmpty(configService, "MINIO_BUCKET") ?? nonEmpty(configService, "STORAGE_BUCKET")
    const configured = Boolean(endpoint && accessKeyId && secretAccessKey && bucket)

    super({
      provider: StorageProvider.MINIO,
      bucket: configured ? bucket : undefined,
      region: nonEmpty(configService, "MINIO_REGION") ?? "us-east-1",
      endpoint,
      publicEndpoint: nonEmpty(configService, "MINIO_PUBLIC_URL"),
      forcePathStyle: true,
      accessKeyId,
      secretAccessKey,
    })
  }
}

function nonEmpty(configService: ConfigService, key: string) {
  const value = configService.get<string>(key)?.trim()
  return value ? value : undefined
}
