import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import { JOB_NAMES, JOB_QUEUE_NAMES, type ImageMigrationPayload, type ImportJobPayload } from "@workspace/jobs"
import type { Job, Queue } from "bullmq"
import { ImageMigrationService } from "../images/image-migration.service.js"
import { ImportWorkerService } from "./import-worker.service.js"

@Processor(JOB_QUEUE_NAMES.imports, { concurrency: 2 })
export class ImportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ImportsProcessor.name)

  constructor(
    private readonly importWorkerService: ImportWorkerService,
    private readonly imageMigrationService: ImageMigrationService,
    @InjectQueue(JOB_QUEUE_NAMES.imageMigration)
    private readonly imageQueue: Queue<ImageMigrationPayload>
  ) {
    super()
  }

  async process(job: Job<ImportJobPayload>): Promise<void> {
    await this.importWorkerService.process(job.data, async (progress) => {
      await job.updateProgress(progress)
    })

    const summary = await this.importWorkerService.getResultSurveyIds(job.data.jobId)
    const payloads = await this.imageMigrationService.listPendingForSurveys(
      job.data.jobId,
      summary,
      job.data.createdById
    )

    if (!payloads.length) return

    // Reset counters so photoSuccess/Failure track migration outcomes (not DB upserts).
    await this.imageMigrationService.resetImportPhotoCounters(job.data.jobId)

    await this.imageQueue.addBulk(
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
    this.logger.log(`Enqueued ${payloads.length} image migration jobs for import ${job.data.jobId}`)
  }
}
