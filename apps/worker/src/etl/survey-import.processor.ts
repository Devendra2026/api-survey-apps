import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import { MigrationJobType } from "@workspace/database"
import { emptyEtlJobStats } from "@workspace/etl-core"
import { JOB_NAMES, JOB_QUEUE_NAMES, type EtlSurveyBatchPayload, type EtlSurveyImportPayload } from "@workspace/jobs"
import type { Job, Queue } from "bullmq"
import { createHash } from "node:crypto"
import { PrismaService } from "../database/prisma.service.js"
import { EtlOrchestratorService } from "./etl-orchestrator.service.js"
import { toQueueError } from "./queue-error.js"

/** Sentinel payload id used by the repeatable cron job; resolved to a real row per tick. */
const CRON_PLACEHOLDER_ID = "cron-incremental"

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

    if (payload.migrationJobId === CRON_PLACEHOLDER_ID) {
      payload = await this.resolveCronPayload(job, payload)
    }

    await this.prisma.db.migrationJob.update({
      where: { id: payload.migrationJobId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        cursor: payload.cursor,
      },
    })

    try {
      const page =
        payload.type === "REFRESH_PENDING" || payload.refreshPending
          ? await this.orchestrator.listPendingRefreshIds(payload.cursor, payload.batchSize, payload.districtId)
          : await this.orchestrator.listBatchIds(payload.cursor, payload.batchSize)
      let enqueued = 0

      for (const legacySurveyId of page.ids) {
        const child: EtlSurveyImportPayload = {
          migrationJobId: payload.migrationJobId,
          correlationId: payload.correlationId,
          legacySurveyId,
          type: payload.type,
          createdById: payload.createdById,
          districtId: payload.districtId,
          refreshPending: payload.type === "REFRESH_PENDING" || payload.refreshPending === true,
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
        // Hash the full cursor — truncating opaque Convex cursors caused duplicate
        // BullMQ jobIds across pages and stalled/retried the same cursor.
        const cursorKey = createHash("sha256").update(page.continueCursor).digest("hex").slice(0, 32)
        await this.surveyQueue.add(
          JOB_NAMES.importSurveyBatch,
          {
            ...payload,
            cursor: page.continueCursor,
          },
          {
            jobId: `${payload.migrationJobId}-batch-${cursorKey}`,
            // Back off between pages so Convex is not hammered every ~500ms.
            delay: page.ids.length === 0 ? 3_000 : 2_000,
            removeOnComplete: true,
            removeOnFail: { count: 2_000 },
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
    } catch (err) {
      await this.orchestrator.failJob({
        migrationJobId: payload.migrationJobId,
        correlationId: payload.correlationId,
        error: err,
        attempt: { attemptsMade: job.attemptsMade, maxAttempts: job.opts.attempts },
      })
      throw toQueueError(err, this.logger)
    }
  }

  /**
   * Resolves the cron sentinel to a MigrationJob row, reusing the row already
   * created for this queue job. Creating one per attempt left every non-final
   * retry stranded in RUNNING, which then blocked full migrations.
   */
  private async resolveCronPayload(
    job: Job<EtlSurveyBatchPayload>,
    payload: EtlSurveyBatchPayload
  ): Promise<EtlSurveyBatchPayload> {
    const correlationId = `cron:${job.id ?? job.timestamp}`
    const existing = await this.prisma.db.migrationJob.findFirst({
      where: { correlationId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })

    const migrationJobId =
      existing?.id ??
      (
        await this.prisma.db.migrationJob.create({
          data: {
            type: MigrationJobType.INCREMENTAL,
            status: "QUEUED",
            batchSize: payload.batchSize,
            correlationId,
            statsJson: emptyEtlJobStats(),
          },
          select: { id: true },
        })
      ).id

    const resolved: EtlSurveyBatchPayload = { ...payload, migrationJobId, correlationId, cursor: null }
    // Persist so continuation batches and any further retry see the real id.
    await job.updateData(resolved).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.warn(`Could not persist resolved ETL cron payload: ${message}`)
    })
    return resolved
  }

  private async processOne(job: Job<EtlSurveyImportPayload>) {
    let result: Awaited<ReturnType<EtlOrchestratorService["processSurveyImport"]>>
    try {
      result = await this.orchestrator.processSurveyImport(job.data)
    } catch (err) {
      throw toQueueError(err, this.logger)
    }
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
