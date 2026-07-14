import { Injectable, Logger } from "@nestjs/common"
import type { ImageMigrationPayload } from "@workspace/jobs"
import { PrismaService } from "../database/prisma.service.js"
import { ObjectStorageService } from "../storage/object-storage.service.js"

const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 750

@Injectable()
export class ImageMigrationService {
  private readonly logger = new Logger(ImageMigrationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: ObjectStorageService
  ) {}

  async process(payload: ImageMigrationPayload): Promise<{ ok: boolean; reason?: string }> {
    const photo = await this.prisma.db.photo.findUnique({
      where: { id: payload.photoId },
      include: {
        survey: {
          select: {
            id: true,
            stateId: true,
            districtId: true,
            ulbId: true,
            wardId: true,
          },
        },
      },
    })

    if (!photo) {
      return { ok: false, reason: "Photo not found" }
    }

    if (photo.objectKey && photo.importStatus === "SUCCEEDED") {
      return { ok: true, reason: "Already migrated" }
    }

    const sourceUrl = payload.sourceUrl || photo.sourceUrl || ""
    if (!sourceUrl.startsWith("http://") && !sourceUrl.startsWith("https://")) {
      await this.markBroken(photo.id, "Invalid or missing source URL")
      return { ok: false, reason: "Invalid source URL" }
    }

    await this.prisma.db.photo.update({
      where: { id: photo.id },
      data: { importStatus: "PROCESSING" },
    })

    try {
      const downloaded = await this.downloadWithRetry(sourceUrl)
      const key = [
        "uploads",
        photo.survey.stateId,
        photo.survey.districtId,
        photo.survey.ulbId,
        photo.survey.wardId,
        "survey",
        photo.surveyId,
        `${photo.id}-${Date.now()}.${downloaded.ext}`,
      ].join("/")

      const uploaded = await this.storageService.putObject({
        key,
        body: downloaded.buffer,
        mimeType: downloaded.mimeType,
        metadata: {
          surveyId: photo.surveyId,
          photoId: photo.id,
          importJobId: payload.importJobId,
          sourceUrl: sourceUrl.slice(0, 500),
        },
      })

      await this.prisma.db.photo.update({
        where: { id: photo.id },
        data: {
          url: key,
          objectKey: uploaded.key,
          bucket: uploaded.bucket,
          storageProvider: uploaded.provider,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          sizeKB: Math.ceil(uploaded.sizeBytes / 1024),
          checksum: uploaded.checksum,
          importStatus: "SUCCEEDED",
          sourceUrl,
        },
      })

      if (payload.importJobId) {
        await this.prisma.db.importJob.update({
          where: { id: payload.importJobId },
          data: { photoSuccessCount: { increment: 1 } },
        })
      }

      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.warn(`Image migration failed photo=${photo.id}: ${message}`)
      await this.markBroken(photo.id, message)
      if (payload.importJobId) {
        await this.prisma.db.importJob.update({
          where: { id: payload.importJobId },
          data: { photoFailureCount: { increment: 1 } },
        })
      }
      return { ok: false, reason: message }
    }
  }

  async resetImportPhotoCounters(importJobId: string): Promise<void> {
    await this.prisma.db.importJob.update({
      where: { id: importJobId },
      data: { photoSuccessCount: 0, photoFailureCount: 0 },
    })
  }

  /** Enqueue-ready payloads for PENDING photos belonging to survey IDs from an import. */
  async listPendingForSurveys(
    importJobId: string,
    surveyIds: string[],
    createdById: string
  ): Promise<ImageMigrationPayload[]> {
    if (!surveyIds.length) return []
    const photos = await this.prisma.db.photo.findMany({
      where: {
        surveyId: { in: surveyIds },
        importStatus: "PENDING",
        sourceUrl: { not: null },
      },
      select: { id: true, surveyId: true, sourceUrl: true, photoType: true },
      take: 50_000,
    })

    return photos
      .filter((p): p is typeof p & { sourceUrl: string } => Boolean(p.sourceUrl))
      .map((p) => ({
        importJobId,
        surveyId: p.surveyId,
        photoId: p.id,
        sourceUrl: p.sourceUrl,
        photoType: p.photoType,
        createdById,
      }))
  }

  private async markBroken(photoId: string, reason: string) {
    await this.prisma.db.photo.update({
      where: { id: photoId },
      data: {
        importStatus: "FAILED",
        url: reason.startsWith("http") ? reason : `broken://${encodeURIComponent(reason.slice(0, 180))}`,
      },
    })
  }

  private async downloadWithRetry(url: string): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
    let lastError: Error | undefined
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, {
          method: "GET",
          redirect: "follow",
          headers: { Accept: "image/*,*/*" },
          signal: AbortSignal.timeout(30_000),
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} downloading image`)
        }
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        if (buffer.byteLength === 0) throw new Error("Empty image body")
        const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || this.detectMime(buffer)
        return { buffer, mimeType, ext: this.extFromMime(mimeType) }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_DELAY_MS * attempt)
        }
      }
    }
    throw lastError ?? new Error("Image download failed")
  }

  private detectMime(buffer: Buffer): string {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg"
    if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return "image/png"
    }
    if (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
      return "image/webp"
    }
    return "application/octet-stream"
  }

  private extFromMime(mimeType: string): string {
    if (mimeType.includes("png")) return "png"
    if (mimeType.includes("webp")) return "webp"
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg"
    return "bin"
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
