import { InjectQueue } from "@nestjs/bullmq"
import { Injectable } from "@nestjs/common"
import {
  JOB_NAMES,
  JOB_QUEUE_NAMES,
  type ExportJobPayload,
  type ImageMigrationPayload,
  type ImportJobPayload,
  type StorageCleanupPayload,
} from "@workspace/jobs"
import type { Queue } from "bullmq"

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(JOB_QUEUE_NAMES.imports) private readonly importsQueue: Queue<ImportJobPayload>,
    @InjectQueue(JOB_QUEUE_NAMES.exports) private readonly exportsQueue: Queue<ExportJobPayload>,
    @InjectQueue(JOB_QUEUE_NAMES.storageCleanup) private readonly storageCleanupQueue: Queue<StorageCleanupPayload>,
    @InjectQueue(JOB_QUEUE_NAMES.imageMigration) private readonly imageMigrationQueue: Queue<ImageMigrationPayload>
  ) {}

  async enqueueImport(payload: ImportJobPayload): Promise<string> {
    const bullJobId =
      payload.resumeFromCheckpoint || payload.retryFailedOnly
        ? `${payload.jobId}-${payload.retryFailedOnly ? "retry" : "resume"}-${Date.now()}`
        : payload.jobId
    const job = await this.importsQueue.add(JOB_NAMES.processImport, payload, {
      jobId: bullJobId,
    })
    return job.id ?? bullJobId
  }

  async enqueueExport(payload: ExportJobPayload): Promise<string> {
    const job = await this.exportsQueue.add(JOB_NAMES.processExport, payload, {
      jobId: payload.jobId,
    })
    return job.id ?? payload.jobId
  }

  async enqueueStorageCleanup(payload: StorageCleanupPayload): Promise<string> {
    const job = await this.storageCleanupQueue.add(JOB_NAMES.deleteObjects, payload)
    return job.id ?? ""
  }

  async enqueueImageMigration(payload: ImageMigrationPayload): Promise<string> {
    const job = await this.imageMigrationQueue.add(JOB_NAMES.migrateImages, payload, {
      jobId: `${payload.photoId}-migrate`,
      attempts: 4,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: true,
      removeOnFail: { count: 5_000 },
    })
    return job.id ?? payload.photoId
  }

  async enqueueImageMigrationBulk(payloads: ImageMigrationPayload[]): Promise<number> {
    if (!payloads.length) return 0
    await this.imageMigrationQueue.addBulk(
      payloads.map((payload) => ({
        name: JOB_NAMES.migrateImages,
        data: payload,
        opts: {
          jobId: `${payload.photoId}-migrate`,
          attempts: 4,
          backoff: { type: "exponential", delay: 2_000 },
          removeOnComplete: true,
          removeOnFail: { count: 5_000 },
        },
      }))
    )
    return payloads.length
  }
}
