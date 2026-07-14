import { Injectable, Logger } from "@nestjs/common"
import type { StorageCleanupPayload } from "@workspace/jobs"
import { ObjectStorageService } from "../storage/object-storage.service.js"

@Injectable()
export class StorageCleanupService {
  private readonly logger = new Logger(StorageCleanupService.name)

  constructor(private readonly storageService: ObjectStorageService) {}

  async process(payload: StorageCleanupPayload, updateProgress: (progress: number) => Promise<void>): Promise<void> {
    const total = payload.objectKeys.length
    if (total === 0) {
      await updateProgress(100)
      return
    }

    for (const [index, key] of payload.objectKeys.entries()) {
      await this.storageService.deleteObject(key, payload.bucket)
      await updateProgress(Math.floor(((index + 1) / total) * 100))
      this.logger.log(`Deleted deferred object key=${key} reason=${payload.reason ?? "unspecified"}`)
    }
  }
}
