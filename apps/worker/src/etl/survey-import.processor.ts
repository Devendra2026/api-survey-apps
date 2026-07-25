import { Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import { InjectQueue } from "@nestjs/bullmq"
import { emptyEtlJobStats } from "@workspace/etl-core"
import { MigrationJobType } from "@workspace/database"
import { JOB_NAMES, JOB_QUEUE_NAMES, type EtlSurveyBatchPayload, type EtlSurveyImportPayload } from "@workspace/jobs"
import type { Job, Queue } from "bullmq"
import { randomUUID } from "node:crypto"
import { PrismaService } from "../database/prisma.service.js"
import { EtlOrchestratorService } from "./etl-orchestrator.service.js"

@Processor(JOB_QUEUE_NAMES.etlSurveyImport)
export class EtlSurveyImportProcessor extends WorkerHost {
  private readonly logger = new Logger(EtlSurveyImportProcessor.name)

  constructor(
    private readonly orchestrator: EtlOrchestratorService,
    private readonly prisma: PrismaService,
    @InjectQueue(JOB_QUEUE_NAMES.etlSurveyImport)
    private readonly surveyQueue: Queue<EtlSurveyBatchPayload | EtlSurveyImportPayload>,
    @InjectQueue(JOB_QUEUE_NAMES.etlReport)
    private readonly reportQueue: Queue
  ) {
    super()
  }

  async process(job: Job<EtlSurveyBatchPayload | EtlSurveyImportPayload>): Promise<unknown> {
    if (job.name === JOB_NAMES.importSurveyBatch) {
      return this.processBatch(job as Job<EtlSurveyBatchPayload>)
    }
    if (job.name === JOB_NAMES.importSurvey) {
      return this.processOne(job as Job<EtlSurveyImportPayload>)
    }
    throw new Error(`Unknown ETL survey job: ${job.name}`)
  }

  private async processBatch(job: Job<EtlSurveyBatchPayload>) {
    let payload = job.data

    if (payload.migrationJobId === "cron-incremental") {
      const correlationId = randomUUID()
      const migrationJob = await this.prisma.db.migrationJob.create({
        data: {
          type: MigrationJobType.INCREMENTAL,
          status: "QUEUED",
          batchSize: payload.batchSize,
          correlationId,
          statsJson: emptyEtlJobStats(),
        },
      })
      payload = {
        ...payload,
        migrationJobId: migrationJob.id,
        correlationId,
        cursor: null,
      }
    }

    await this.prisma.db.migrationJob.update({
      where: { id: payload.migrationJobId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        cursor: payload.cursor,
      },
    })

    const page = await this.orchestrator.listBatchIds(payload.cursor, payload.batchSize)
    let enqueued = 0

    for (const legacySurveyId of page.ids) {
      const child: EtlSurveyImportPayload = {
        migrationJobId: payload.migrationJobId,
        correlationId: payload.correlationId,
        legacySurveyId,
        type: payload.type,
        createdById: payload.createdById,
      }
      await this.surveyQueue.add(JOB_NAMES.importSurvey, child, {
        jobId: `${payload.migrationJobId}-${legacySurveyId}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: true,
        removeOnFail: { count: 5_000 },
      })
      enqueued += 1
    }

    await this.prisma.db.migrationJob.update({
      where: { id: payload.migrationJobId },
      data: { cursor: page.continueCursor },
    })

    if (!page.isDone) {
      await this.surveyQueue.add(
        JOB_NAMES.importSurveyBatch,
        {
          ...payload,
          cursor: page.continueCursor,
        },
        {
          jobId: `${payload.migrationJobId}-batch-${page.continueCursor.slice(0, 24)}`,
          delay: 500,
        }
      )
    } else {
      await this.reportQueue.add(JOB_NAMES.generateReport, {
        migrationJobId: payload.migrationJobId,
        correlationId: payload.correlationId,
      })
    }

    this.logger.log(`ETL batch job=${payload.migrationJobId} enqueued=${enqueued} done=${page.isDone}`)
    return { enqueued, isDone: page.isDone, continueCursor: page.continueCursor }
  }

  private async processOne(job: Job<EtlSurveyImportPayload>) {
    const result = await this.orchestrator.processSurveyImport(job.data)
    const delta =
      result.outcome === "imported"
        ? {
            imported: 1,
            imagesDownloaded: result.imagesDownloaded,
            imagesUploaded: result.imagesUploaded,
            missingImages: result.missingImages,
          }
        : result.outcome === "duplicate" || result.outcome === "skipped"
          ? { skipped: 1, duplicates: result.outcome === "duplicate" ? 1 : 0 }
          : { failed: 1 }

    await this.orchestrator.bumpJobStats(job.data.migrationJobId, delta)
    return result
  }
}
