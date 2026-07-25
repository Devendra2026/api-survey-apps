import { Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import { JOB_NAMES, JOB_QUEUE_NAMES, type EtlPhotoPayload } from "@workspace/jobs"
import { extensionFromMime, validateImageBuffer, DEFAULT_MAX_IMAGE_BYTES } from "@workspace/etl-core"
import type { Job } from "bullmq"
import { ConfigService } from "@nestjs/config"
import { ObjectStorageService } from "../storage/object-storage.service.js"

/**
 * Standalone image download+validate stage (used for targeted retries).
 * Primary path downloads inline inside survey import for atomicity.
 */
@Processor(JOB_QUEUE_NAMES.etlImageDownload)
export class EtlImageDownloadProcessor extends WorkerHost {
  private readonly logger = new Logger(EtlImageDownloadProcessor.name)

  constructor(
    private readonly storage: ObjectStorageService,
    private readonly config: ConfigService
  ) {
    super()
  }

  async process(job: Job<EtlPhotoPayload>): Promise<{ ok: boolean; sizeBytes?: number; mimeType?: string }> {
    if (job.name !== JOB_NAMES.downloadPhoto) {
      throw new Error(`Unknown download job: ${job.name}`)
    }
    const { sourceUrl, correlationId, legacySurveyId, slot } = job.data
    const response = await fetch(sourceUrl)
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    const maxBytes = Number(this.config.get("ETL_MAX_IMAGE_BYTES") ?? DEFAULT_MAX_IMAGE_BYTES)
    const validated = validateImageBuffer(buffer, response.headers.get("content-type"), maxBytes)
    if (!validated.ok) {
      throw new Error(validated.error ?? "Invalid image")
    }
    this.logger.log(
      JSON.stringify({
        msg: "etl_image_downloaded",
        correlationId,
        legacySurveyId,
        slot,
        sizeBytes: validated.sizeBytes,
        mimeType: validated.mimeType,
      })
    )
    return { ok: true, sizeBytes: validated.sizeBytes, mimeType: validated.mimeType }
  }
}

@Processor(JOB_QUEUE_NAMES.etlImageUpload)
export class EtlImageUploadProcessor extends WorkerHost {
  private readonly logger = new Logger(EtlImageUploadProcessor.name)

  constructor(
    private readonly storage: ObjectStorageService,
    private readonly config: ConfigService
  ) {
    super()
  }

  async process(job: Job<EtlPhotoPayload & { bodyBase64?: string }>): Promise<{ objectKey: string }> {
    if (job.name !== JOB_NAMES.uploadPhoto) {
      throw new Error(`Unknown upload job: ${job.name}`)
    }
    const payload = job.data
    if (!payload.bodyBase64) {
      // Re-download then upload (retry path)
      const response = await fetch(payload.sourceUrl)
      if (!response.ok) throw new Error(`Re-download failed (${response.status})`)
      const buffer = Buffer.from(await response.arrayBuffer())
      const maxBytes = Number(this.config.get("ETL_MAX_IMAGE_BYTES") ?? DEFAULT_MAX_IMAGE_BYTES)
      const validated = validateImageBuffer(buffer, null, maxBytes)
      if (!validated.ok || !validated.mimeType) throw new Error(validated.error ?? "Invalid image")

      const uploaded = await this.storage.putObject({
        key: payload.objectKey,
        body: buffer,
        mimeType: validated.mimeType,
        metadata: {
          legacySurveyId: payload.legacySurveyId,
          slot: payload.slot,
          correlationId: payload.correlationId,
        },
      })
      this.logger.log(
        JSON.stringify({
          msg: "etl_image_uploaded",
          correlationId: payload.correlationId,
          legacySurveyId: payload.legacySurveyId,
          objectKey: uploaded.key,
          sizeBytes: uploaded.sizeBytes,
        })
      )
      return { objectKey: uploaded.key }
    }

    const buffer = Buffer.from(payload.bodyBase64, "base64")
    const validated = validateImageBuffer(buffer)
    if (!validated.ok || !validated.mimeType) throw new Error(validated.error ?? "Invalid image")
    const uploaded = await this.storage.putObject({
      key: payload.objectKey.replace(/\.webp$/i, `.${extensionFromMime(validated.mimeType)}`),
      body: buffer,
      mimeType: validated.mimeType,
    })
    return { objectKey: uploaded.key }
  }
}
