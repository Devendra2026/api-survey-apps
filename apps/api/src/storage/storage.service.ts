import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { randomUUID } from "node:crypto"
import type { StorageService as StorageServicePort, StorageUploadResult } from "./storage.types.js"
import { STORAGE_SERVICE } from "./storage.types.js"

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
  bucket: string
  provider: StorageUploadResult["provider"]
  sizeBytes: number
  sizeKB: number
  mimeType: string
  checksum?: string
  etag?: string
}

export interface UploadStoredObjectInput {
  buffer: Buffer
  mimeType: string
  originalName: string
  key: string
  metadata?: Record<string, string>
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly maxBytes: number

  constructor(
    private readonly configService: ConfigService,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageServicePort
  ) {
    this.maxBytes =
      this.configService.get<number>("UPLOAD_MAX_FILE_SIZE_BYTES") ??
      this.configService.get<number>("STORAGE_MAX_FILE_SIZE_BYTES") ??
      this.configService.get<number>("AWS_S3_MAX_FILE_SIZE_BYTES") ??
      5 * 1024 * 1024
  }

  isConfigured(): boolean {
    return this.storageService.isConfigured()
  }

  healthCheck() {
    return this.storageService.healthCheck()
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException("Object storage is not configured")
    }
  }

  validateImage(mimeType: string, sizeBytes: number, buffer?: Buffer) {
    const normalizedMimeType = this.normalizeMimeType(mimeType)
    if (!ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
      throw new BadRequestException(`Invalid image MIME type: ${mimeType}. Allowed: jpeg, png, webp`)
    }
    if (sizeBytes <= 0 || sizeBytes > this.maxBytes) {
      throw new BadRequestException(`Image must be between 1 byte and ${this.maxBytes} bytes`)
    }
    if (buffer && this.detectMimeType(buffer) !== normalizedMimeType) {
      throw new BadRequestException("Image content does not match the declared MIME type")
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
    this.validateImage(input.mimeType, input.buffer.byteLength, input.buffer)

    const ext = this.extensionFromMime(input.mimeType)
    const key = this.buildKey(input, ext)

    try {
      const uploaded = await this.storageService.uploadObject({
        key,
        body: input.buffer,
        mimeType: this.normalizeMimeType(input.mimeType),
        metadata: {
          surveyId: input.surveyId,
          originalName: input.originalName.slice(0, 200),
        },
      })
      this.logger.log(`Object upload success key=${key} survey=${input.surveyId}`)
      return {
        ...uploaded,
        sizeKB: Math.ceil(input.buffer.byteLength / 1024),
      }
    } catch (err) {
      this.logger.error(`Object upload failed for key=${key}: ${String(err)}`)
      throw new ServiceUnavailableException("Failed to upload image")
    }
  }

  async uploadStoredObject(input: UploadStoredObjectInput): Promise<StorageUploadResult> {
    this.assertConfigured()
    if (input.buffer.byteLength <= 0) {
      throw new BadRequestException("Object must be at least 1 byte")
    }

    try {
      const uploaded = await this.storageService.uploadObject({
        key: input.key,
        body: input.buffer,
        mimeType: input.mimeType,
        metadata: {
          originalName: input.originalName.slice(0, 200),
          ...(input.metadata ?? {}),
        },
      })
      this.logger.log(`Object upload success key=${input.key}`)
      return uploaded
    } catch (err) {
      this.logger.error(`Object upload failed for key=${input.key}: ${String(err)}`)
      throw new ServiceUnavailableException("Failed to upload object")
    }
  }

  async deleteObject(keyOrUrl: string) {
    if (!this.isConfigured()) return
    const key = this.extractKey(keyOrUrl)
    if (!key) return

    try {
      await this.storageService.deleteObject(key)
      this.logger.log(`Object delete success key=${key}`)
    } catch (err) {
      this.logger.warn(`Object delete failed for key=${key}: ${String(err)}`)
    }
  }

  async getPresignedUploadUrl(key: string, mimeType: string, expiresIn = 900) {
    this.assertConfigured()
    this.validateImage(mimeType, 1)
    return this.storageService.getSignedUploadUrl({
      key,
      mimeType: this.normalizeMimeType(mimeType),
      expiresInSeconds: expiresIn,
    })
  }

  async getPresignedDownloadUrl(key: string, expiresIn = 900) {
    this.assertConfigured()
    return this.storageService.getSignedDownloadUrl(key, expiresIn)
  }

  extractKey(keyOrUrl: string): string | null {
    if (!keyOrUrl) return null
    if (keyOrUrl.startsWith("uploads/") || keyOrUrl.startsWith("imports/") || keyOrUrl.startsWith("exports/")) {
      return keyOrUrl
    }
    try {
      const url = new URL(keyOrUrl)
      const path = url.pathname.replace(/^\//, "")
      const bucket = path.split("/")[0]
      if (
        bucket &&
        (path.startsWith(`${bucket}/uploads/`) ||
          path.startsWith(`${bucket}/imports/`) ||
          path.startsWith(`${bucket}/exports/`))
      ) {
        return path.slice(bucket.length + 1)
      }
      return path || null
    } catch {
      return null
    }
  }

  private normalizeMimeType(mimeType: string) {
    return mimeType.toLowerCase() === "image/jpg" ? "image/jpeg" : mimeType.toLowerCase()
  }

  private detectMimeType(buffer: Buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg"
    }
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return "image/png"
    }
    if (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
      return "image/webp"
    }
    return null
  }

  private extensionFromMime(mimeType: string) {
    switch (this.normalizeMimeType(mimeType)) {
      case "image/png":
        return "png"
      case "image/webp":
        return "webp"
      default:
        return "jpg"
    }
  }
}
