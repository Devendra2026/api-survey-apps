import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Req,
  ServiceUnavailableException,
  StreamableFile,
} from "@nestjs/common"
import { ApiOperation, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"
import type { Request } from "express"
import { Public } from "../common/decorators/public.decorator.js"
import { looksLikeStorageKey } from "../surveys/survey-photo-urls.js"
import { StorageService } from "./storage.service.js"

/**
 * Public object proxy for Excel Parcel Images hyperlinks.
 * GET /api/storage/{objectKey...} → stream from MinIO/S3 (bucket from env, key = path after /api/storage/).
 * Matches the link design used by ward survey exports (backend host + /api/storage/<object-path>).
 */
@ApiTags("storage")
@Controller("api/storage")
export class PublicStorageController {
  private readonly logger = new Logger(PublicStorageController.name)

  constructor(private readonly storageService: StorageService) {}

  @Public()
  @Get("*path")
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary: "Stream a private survey photo by object key (Excel / public hyperlinks)",
  })
  async streamByObjectKey(@Param("path") path: string | string[], @Req() req: Request): Promise<StreamableFile> {
    if (!this.storageService.isConfigured()) {
      throw new ServiceUnavailableException("Object storage is not configured")
    }

    const objectKey = normalizeObjectKey(path, req)
    if (!objectKey || !looksLikeStorageKey(objectKey)) {
      throw new NotFoundException("Storage object not found")
    }

    try {
      const file = await this.storageService.getObjectStream(objectKey)
      return new StreamableFile(file.body, {
        type: file.contentType ?? "application/octet-stream",
        length: file.contentLength,
        disposition: `inline; filename="${safeFileName(objectKey)}"`,
      })
    } catch (err) {
      this.logger.warn(`Public storage miss key=${objectKey}: ${String(err)}`)
      throw new NotFoundException("Storage object not found")
    }
  }
}

function normalizeObjectKey(path: string | string[], req: Request): string | null {
  let raw: string
  if (Array.isArray(path)) {
    raw = path.join("/")
  } else if (typeof path === "string" && path.length > 0) {
    raw = path
  } else {
    const urlPath = (req.path ?? req.url?.split("?")[0] ?? "").replace(/^\/+/, "")
    raw = urlPath.replace(/^api\/storage\/?/i, "")
  }

  const decoded = raw
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .filter((segment) => segment.length > 0)
    .join("/")

  if (!decoded || decoded.includes("..") || decoded.includes("\\")) return null
  return decoded
}

function safeFileName(objectKey: string): string {
  const base = objectKey.split("/").pop()?.trim() || "file"
  return base.replace(/[^\w.-]+/g, "_").slice(0, 180)
}
