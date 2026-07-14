import { Processor, WorkerHost } from "@nestjs/bullmq"
import { JOB_QUEUE_NAMES, type ImageMigrationPayload } from "@workspace/jobs"
import type { Job } from "bullmq"
import { ImageMigrationService } from "./image-migration.service.js"

@Processor(JOB_QUEUE_NAMES.imageMigration, { concurrency: 5 })
export class ImageMigrationProcessor extends WorkerHost {
  constructor(private readonly imageMigrationService: ImageMigrationService) {
    super()
  }

  async process(job: Job<ImageMigrationPayload>): Promise<void> {
    const result = await this.imageMigrationService.process(job.data)
    // Broken images must not fail the queue permanently after retries — mark done.
    if (!result.ok && result.reason !== "Photo not found") {
      // Let BullMQ retry transient failures; permanent URL issues already marked FAILED.
      if (result.reason?.includes("HTTP 404") || result.reason?.includes("Invalid")) {
        return
      }
      throw new Error(result.reason ?? "Image migration failed")
    }
  }
}
