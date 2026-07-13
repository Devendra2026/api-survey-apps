import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { randomUUID } from "node:crypto"

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"])

export interface UploadImageInput {
  buffer: Buffer
  mimeType: string
  originalName: string
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
  surveyId: string
}

export interface UploadImageResult {
  key: string
  url: string
  sizeKB: number
  mimeType: string
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly client: S3Client | null
  private readonly bucket: string | undefined
  private readonly publicUrl: string | undefined
  private readonly maxBytes: number
  private readonly region: string | undefined

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>("AWS_S3_BUCKET")
    this.publicUrl = this.configService.get<string>("AWS_S3_PUBLIC_URL")
    this.region = this.configService.get<string>("AWS_REGION") ?? "ap-south-1"
    this.maxBytes = this.configService.get<number>("AWS_S3_MAX_FILE_SIZE_BYTES") ?? 5 * 1024 * 1024

    const accessKeyId = this.configService.get<string>("AWS_ACCESS_KEY_ID")
    const secretAccessKey = this.configService.get<string>("AWS_SECRET_ACCESS_KEY")

    if (accessKeyId && secretAccessKey && this.bucket) {
      this.client = new S3Client({
        region: this.region,
        credentials: { accessKeyId, secretAccessKey },
      })
    } else {
      this.client = null
      this.logger.warn("AWS S3 is not fully configured; uploads will fail until env vars are set")
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.bucket)
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException("AWS S3 storage is not configured")
    }
  }

  validateImage(mimeType: string, sizeBytes: number) {
    if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      throw new BadRequestException(`Invalid image MIME type: ${mimeType}. Allowed: jpeg, png, webp`)
    }
    if (sizeBytes <= 0 || sizeBytes > this.maxBytes) {
      throw new BadRequestException(`Image must be between 1 byte and ${this.maxBytes} bytes`)
    }
  }

  buildKey(input: Omit<UploadImageInput, "buffer" | "mimeType" | "originalName">, ext: string) {
    return [
      "uploads",
      input.stateId,
      input.districtId,
      input.ulbId,
      input.wardId,
      "survey",
      input.surveyId,
      `${randomUUID()}.${ext}`,
    ].join("/")
  }

  async uploadImage(input: UploadImageInput): Promise<UploadImageResult> {
    this.assertConfigured()
    this.validateImage(input.mimeType, input.buffer.byteLength)

    const ext = this.extensionFromMime(input.mimeType)
    const key = this.buildKey(input, ext)

    try {
      await this.client!.send(
        new PutObjectCommand({
          Bucket: this.bucket!,
          Key: key,
          Body: input.buffer,
          ContentType: input.mimeType,
          Metadata: {
            surveyId: input.surveyId,
            originalName: input.originalName.slice(0, 200),
          },
        })
      )
    } catch (err) {
      this.logger.error(`S3 upload failed for key=${key}: ${String(err)}`)
      throw new ServiceUnavailableException("Failed to upload image to S3")
    }

    const url = this.toPublicUrl(key)
    this.logger.log(`S3 upload success key=${key} survey=${input.surveyId}`)
    return {
      key,
      url,
      sizeKB: Math.ceil(input.buffer.byteLength / 1024),
      mimeType: input.mimeType,
    }
  }

  async deleteObject(keyOrUrl: string) {
    if (!this.isConfigured()) return
    const key = this.extractKey(keyOrUrl)
    if (!key) return

    try {
      await this.client!.send(
        new DeleteObjectCommand({
          Bucket: this.bucket!,
          Key: key,
        })
      )
      this.logger.log(`S3 delete success key=${key}`)
    } catch (err) {
      this.logger.warn(`S3 delete failed for key=${key}: ${String(err)}`)
    }
  }

  async getPresignedUploadUrl(key: string, mimeType: string, expiresIn = 900) {
    this.assertConfigured()
    this.validateImage(mimeType, 1)
    const command = new PutObjectCommand({
      Bucket: this.bucket!,
      Key: key,
      ContentType: mimeType,
    })
    return getSignedUrl(this.client!, command, { expiresIn })
  }

  toPublicUrl(key: string) {
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, "")}/${key}`
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`
  }

  extractKey(keyOrUrl: string): string | null {
    if (!keyOrUrl) return null
    if (keyOrUrl.startsWith("uploads/")) return keyOrUrl
    try {
      const url = new URL(keyOrUrl)
      return url.pathname.replace(/^\//, "") || null
    } catch {
      return null
    }
  }

  private extensionFromMime(mimeType: string) {
    switch (mimeType.toLowerCase()) {
      case "image/png":
        return "png"
      case "image/webp":
        return "webp"
      default:
        return "jpg"
    }
  }
}
