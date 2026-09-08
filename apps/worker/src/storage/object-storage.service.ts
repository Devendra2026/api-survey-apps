import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { Injectable, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { StorageProvider } from "@workspace/database"
import { createHash } from "node:crypto"

export interface StoredObjectResult {
  key: string
  bucket: string
  provider: StorageProvider
  sizeBytes: number
  mimeType: string
  checksum: string
}

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client | null
  private readonly publicClient: S3Client | null
  private readonly bucket: string | undefined
  private readonly provider: StorageProvider

  constructor(configService: ConfigService) {
    const provider = configService.get<string>("STORAGE_PROVIDER")?.trim().toLowerCase()
    this.provider = provider === "minio" ? StorageProvider.MINIO : StorageProvider.S3

    if (this.provider === StorageProvider.MINIO) {
      this.bucket = nonEmpty(configService, "MINIO_BUCKET") ?? nonEmpty(configService, "STORAGE_BUCKET")
      const region = nonEmpty(configService, "MINIO_REGION") ?? "us-east-1"
      const endpoint = nonEmpty(configService, "MINIO_ENDPOINT")
      const publicEndpoint = nonEmpty(configService, "MINIO_PUBLIC_URL")
      const accessKeyId = nonEmpty(configService, "MINIO_ACCESS_KEY") ?? nonEmpty(configService, "MINIO_ROOT_USER")
      const secretAccessKey =
        nonEmpty(configService, "MINIO_SECRET_KEY") ?? nonEmpty(configService, "MINIO_ROOT_PASSWORD")
      this.client = this.bucket
        ? createClient({
            region,
            endpoint,
            forcePathStyle: true,
            accessKeyId,
            secretAccessKey,
          })
        : null
      this.publicClient =
        this.client && publicEndpoint && publicEndpoint !== endpoint
          ? createClient({
              region,
              endpoint: publicEndpoint,
              forcePathStyle: true,
              accessKeyId,
              secretAccessKey,
            })
          : null
      return
    }

    this.bucket = nonEmpty(configService, "AWS_S3_BUCKET")
    const region = nonEmpty(configService, "AWS_REGION") ?? "ap-south-1"
    const endpoint = nonEmpty(configService, "AWS_S3_ENDPOINT")
    const publicEndpoint = nonEmpty(configService, "AWS_S3_PUBLIC_URL")
    const forcePathStyle = boolValue(configService, "AWS_S3_FORCE_PATH_STYLE")
    const accessKeyId = nonEmpty(configService, "AWS_ACCESS_KEY_ID")
    const secretAccessKey = nonEmpty(configService, "AWS_SECRET_ACCESS_KEY")
    this.client = this.bucket
      ? createClient({
          region,
          endpoint,
          forcePathStyle,
          accessKeyId,
          secretAccessKey,
        })
      : null
    this.publicClient =
      this.client && publicEndpoint && publicEndpoint !== endpoint
        ? createClient({
            region,
            endpoint: publicEndpoint,
            forcePathStyle: forcePathStyle ?? true,
            accessKeyId,
            secretAccessKey,
          })
        : null
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.bucket)
  }

  /** Signed GET URL. Returns null when storage is not configured. Does not throw. */
  async getSignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string | null> {
    if (!this.client || !this.bucket) return null
    const signer = this.publicClient ?? this.client
    return getSignedUrl(
      signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      { expiresIn: expiresInSeconds }
    )
  }

  async getObjectBuffer(key: string, bucket = this.bucket): Promise<Buffer> {
    this.assertConfigured(bucket)
    const response = await this.client!.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!response.Body) return Buffer.alloc(0)

    const chunks: Buffer[] = []
    for await (const chunk of response.Body as AsyncIterable<Buffer | Uint8Array>) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  async putObject(input: {
    key: string
    body: Buffer
    mimeType: string
    bucket?: string
    metadata?: Record<string, string>
  }): Promise<StoredObjectResult> {
    const bucket = input.bucket ?? this.bucket
    this.assertConfigured(bucket)

    await this.client!.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.mimeType,
        Metadata: input.metadata,
      })
    )

    return {
      key: input.key,
      bucket,
      provider: this.provider,
      sizeBytes: input.body.byteLength,
      mimeType: input.mimeType,
      checksum: createHash("sha256").update(input.body).digest("hex"),
    }
  }

  async deleteObject(key: string, bucket = this.bucket): Promise<void> {
    if (!this.client || !bucket) return
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  }

  private assertConfigured(bucket: string | undefined): asserts bucket is string {
    if (!this.client || !bucket) {
      throw new ServiceUnavailableException("Object storage is not configured")
    }
  }
}

function createClient(options: {
  region: string
  endpoint?: string
  forcePathStyle?: boolean
  accessKeyId?: string
  secretAccessKey?: string
}) {
  const config: S3ClientConfig = {
    region: options.region,
    endpoint: options.endpoint,
    forcePathStyle: options.forcePathStyle,
  }
  if (options.accessKeyId && options.secretAccessKey) {
    config.credentials = {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    }
  }
  return new S3Client(config)
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
