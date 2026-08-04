import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { S3CompatibleStorage } from "./s3-compatible.storage.js"
import { StorageProvider } from "./storage.types.js"

@Injectable()
export class AwsS3StorageService extends S3CompatibleStorage {
  constructor(configService: ConfigService) {
    const accessKeyId = nonEmpty(configService, "AWS_ACCESS_KEY_ID")
    const secretAccessKey = nonEmpty(configService, "AWS_SECRET_ACCESS_KEY")

    super({
      provider: StorageProvider.S3,
      bucket: nonEmpty(configService, "AWS_S3_BUCKET"),
      region: nonEmpty(configService, "AWS_REGION") ?? "ap-south-1",
      endpoint: nonEmpty(configService, "AWS_S3_ENDPOINT"),
      publicEndpoint: nonEmpty(configService, "AWS_S3_PUBLIC_URL"),
      forcePathStyle: boolValue(configService, "AWS_S3_FORCE_PATH_STYLE"),
      accessKeyId,
      secretAccessKey,
      defaultAcl: "private",
    })
  }
}

function nonEmpty(configService: ConfigService, key: string) {
  const value = configService.get<string>(key)?.trim()
  return value ? value : undefined
}

function boolValue(configService: ConfigService, key: string) {
  const value = nonEmpty(configService, key)?.toLowerCase()
  if (value == null) return undefined
  return value === "true" || value === "1" || value === "yes"
}
