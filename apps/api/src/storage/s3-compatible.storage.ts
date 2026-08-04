import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { createHash } from "node:crypto"
import type { Readable } from "node:stream"
import type {
  SignedUploadUrlInput,
  StorageHealthCheck,
  StorageService,
  StorageUploadResult,
  UploadObjectInput,
} from "./storage.types.js"
import { StorageProvider } from "./storage.types.js"

interface S3CompatibleClientOptions {
  region: string
  endpoint?: string
  forcePathStyle?: boolean
  accessKeyId?: string
  secretAccessKey?: string
}

interface S3CompatibleStorageOptions extends S3CompatibleClientOptions {
  bucket?: string
  provider: StorageProvider
  defaultAcl?: "private"
  /** Browser-reachable endpoint for presigned URLs (e.g. https://files.example.com). */
  publicEndpoint?: string
}

export function createS3CompatibleClient(options: S3CompatibleClientOptions) {
  const clientConfig: S3ClientConfig = {
    region: options.region,
    endpoint: options.endpoint,
    forcePathStyle: options.forcePathStyle,
  }

  if (options.accessKeyId && options.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    }
  }

  return new S3Client(clientConfig)
}

export class S3CompatibleStorage implements StorageService {
  private readonly client: S3Client | null
  private readonly publicClient: S3Client | null

  constructor(private readonly options: S3CompatibleStorageOptions) {
    this.client = this.isConfigured()
      ? createS3CompatibleClient({
          region: options.region,
          endpoint: options.endpoint,
          forcePathStyle: options.forcePathStyle,
          accessKeyId: options.accessKeyId,
          secretAccessKey: options.secretAccessKey,
        })
      : null

    this.publicClient =
      this.isConfigured() && options.publicEndpoint && options.publicEndpoint !== options.endpoint
        ? createS3CompatibleClient({
            region: options.region,
            endpoint: options.publicEndpoint,
            forcePathStyle: options.forcePathStyle ?? true,
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
          })
        : null
  }

  isConfigured() {
    return Boolean(this.options.bucket)
  }

  async uploadObject(input: UploadObjectInput): Promise<StorageUploadResult> {
    this.assertConfigured()

    const checksum = createHash("sha256").update(input.body).digest("hex")
    const response = await this.client!.send(
      new PutObjectCommand({
        Bucket: this.options.bucket!,
        Key: input.key,
        Body: input.body,
        ContentType: input.mimeType,
        ACL: this.options.defaultAcl,
        Metadata: input.metadata,
      })
    )
    const url = await this.getSignedDownloadUrl(input.key)

    return {
      key: input.key,
      url,
      bucket: this.options.bucket!,
      provider: this.options.provider,
      sizeBytes: input.body.byteLength,
      mimeType: input.mimeType,
      checksum,
      etag: response.ETag?.replace(/^"|"$/g, ""),
    }
  }

  async deleteObject(key: string) {
    if (!this.isConfigured()) return

    await this.client!.send(
      new DeleteObjectCommand({
        Bucket: this.options.bucket!,
        Key: key,
      })
    )
  }

  async getObjectStream(key: string): Promise<{
    body: Readable
    contentType?: string
    contentLength?: number
  }> {
    this.assertConfigured()
    const response = await this.client!.send(
      new GetObjectCommand({
        Bucket: this.options.bucket!,
        Key: key,
      })
    )
    if (!response.Body) {
      throw new Error(`Object not found: ${key}`)
    }
    return {
      body: response.Body as Readable,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
    }
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 900) {
    this.assertConfigured()
    // Prefer public endpoint so browsers can reach the URL (internal minio:9000 hosts fail with "Failed to fetch").
    const signer = this.publicClient ?? this.client!
    return getSignedUrl(
      signer,
      new GetObjectCommand({
        Bucket: this.options.bucket!,
        Key: key,
      }),
      { expiresIn: expiresInSeconds }
    )
  }

  async getSignedUploadUrl(input: SignedUploadUrlInput) {
    this.assertConfigured()
    return getSignedUrl(
      this.client!,
      new PutObjectCommand({
        Bucket: this.options.bucket!,
        Key: input.key,
        ContentType: input.mimeType,
        ACL: this.options.defaultAcl,
      }),
      { expiresIn: input.expiresInSeconds ?? 900 }
    )
  }

  async healthCheck(): Promise<StorageHealthCheck> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        healthy: false,
        provider: this.options.provider,
      }
    }

    try {
      await this.client!.send(new HeadBucketCommand({ Bucket: this.options.bucket! }))
      return {
        configured: true,
        healthy: true,
        provider: this.options.provider,
        bucket: this.options.bucket,
      }
    } catch (err) {
      return {
        configured: true,
        healthy: false,
        provider: this.options.provider,
        bucket: this.options.bucket,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  private assertConfigured() {
    if (!this.client || !this.options.bucket) {
      throw new Error(`${this.options.provider} storage is not configured`)
    }
  }
}
