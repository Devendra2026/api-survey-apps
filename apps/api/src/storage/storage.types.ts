import { StorageProvider } from "@workspace/database"

export { StorageProvider }

export const STORAGE_SERVICE = Symbol("STORAGE_SERVICE")

export interface UploadObjectInput {
  key: string
  body: Buffer
  mimeType: string
  metadata?: Record<string, string>
}

export interface SignedUploadUrlInput {
  key: string
  mimeType: string
  expiresInSeconds?: number
}

export interface StorageUploadResult {
  key: string
  url: string
  bucket: string
  provider: StorageProvider
  sizeBytes: number
  mimeType: string
  checksum?: string
  etag?: string
}

export interface StorageHealthCheck {
  configured: boolean
  healthy: boolean
  provider: StorageProvider
  bucket?: string
  error?: string
}

export interface StorageService {
  uploadObject(input: UploadObjectInput): Promise<StorageUploadResult>
  deleteObject(key: string): Promise<void>
  getObjectStream(key: string): Promise<{
    body: import("node:stream").Readable
    contentType?: string
    contentLength?: number
  }>
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>
  getSignedUploadUrl(input: SignedUploadUrlInput): Promise<string>
  isConfigured(): boolean
  healthCheck(): Promise<StorageHealthCheck>
}
