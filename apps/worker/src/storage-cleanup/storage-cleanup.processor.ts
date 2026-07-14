import { Processor, WorkerHost } from "@nestjs/bullmq"
import { JOB_QUEUE_NAMES, type StorageCleanupPayload } from "@workspace/jobs"
import type { Job } from "bullmq"
import { StorageCleanupService } from "./storage-cleanup.service.js"

@Processor(JOB_QUEUE_NAMES.storageCleanup, { concurrency: 5 })
export class StorageCleanupProcessor extends WorkerHost {
  constructor(private readonly storageCleanupService: StorageCleanupService) {
    super()
  }

  async process(job: Job<StorageCleanupPayload>): Promise<void> {
    await this.storageCleanupService.process(job.data, async (progress) => {
      await job.updateProgress(progress)
    })
  }
}
