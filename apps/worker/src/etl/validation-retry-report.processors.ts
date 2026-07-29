import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import { finalizeJobStats } from "@workspace/etl-core"
import {
  JOB_NAMES,
  JOB_QUEUE_NAMES,
  type EtlReportPayload,
  type EtlRetryPayload,
  type EtlSurveyImportPayload,
  type EtlValidatePayload,
} from "@workspace/jobs"
import type { Job, Queue } from "bullmq"
import { PrismaService } from "../database/prisma.service.js"
import { EtlOrchestratorService } from "./etl-orchestrator.service.js"

@Processor(JOB_QUEUE_NAMES.etlValidation)
export class EtlValidationProcessor extends WorkerHost {
  private readonly logger = new Logger(EtlValidationProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: EtlOrchestratorService
  ) {
    super()
  }

  async process(job: Job<EtlValidatePayload>) {
    if (job.name !== JOB_NAMES.validateJob) {
      throw new Error(`Unknown validate job: ${job.name}`)
    }

    try {
      const convexCount = await this.orchestrator.countConvexSurveys()
      const pgCount = await this.prisma.db.survey.count({
        where: { legacySurveyId: { not: null }, deletedAt: null },
      })
      const photoCount = await this.prisma.db.photo.count({
        where: { survey: { legacySurveyId: { not: null }, deletedAt: null } },
      })
      const convexUrlPhotos = await this.prisma.db.photo.count({
        where: {
          survey: { legacySurveyId: { not: null }, deletedAt: null },
          OR: [{ sourceUrl: { contains: "convex" } }, { url: { contains: "convex" } }, { objectKey: null }],
        },
      })

      const report = {
        convexSurveyCount: convexCount,
        postgresSurveyCount: pgCount,
        photoCount,
        photosMissingObjectKeyOrConvexUrl: convexUrlPhotos,
        deltaSurveys: convexCount - pgCount,
        validatedAt: new Date().toISOString(),
      }

      await this.prisma.db.migrationJob.update({
        where: { id: job.data.migrationJobId },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
          statsJson: report,
        },
      })

      await this.orchestrator.appendLog(
        job.data.migrationJobId,
        "info",
        "Validation complete",
        undefined,
        job.data.correlationId,
        report
      )

      this.logger.log(JSON.stringify({ msg: "etl_validation", ...report }))
      return report
    } catch (err) {
      await this.orchestrator.failJob({
        migrationJobId: job.data.migrationJobId,
        correlationId: job.data.correlationId,
        error: err,
        attempt: { attemptsMade: job.attemptsMade, maxAttempts: job.opts.attempts },
      })
      throw err
    }
  }
}

@Processor(JOB_QUEUE_NAMES.etlRetry)
export class EtlRetryProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: EtlOrchestratorService,
    @InjectQueue(JOB_QUEUE_NAMES.etlSurveyImport)
    private readonly surveyQueue: Queue<EtlSurveyImportPayload>
  ) {
    super()
  }

  async process(job: Job<EtlRetryPayload>) {
    if (job.name !== JOB_NAMES.retryFailed) {
      throw new Error(`Unknown retry job: ${job.name}`)
    }

    try {
      const failures = await this.prisma.db.failedImport.findMany({
        where: {
          resolvedAt: null,
          retryCount: { lt: job.data.maxRetries },
        },
        take: 500,
        orderBy: { createdAt: "asc" },
      })

      let enqueued = 0
      for (const failure of failures) {
        await this.surveyQueue.add(
          JOB_NAMES.importSurvey,
          {
            migrationJobId: job.data.migrationJobId,
            correlationId: job.data.correlationId,
            legacySurveyId: failure.legacySurveyId,
            type: "RETRY_FAILED",
            createdById: job.data.createdById,
          },
          {
            jobId: `${job.data.migrationJobId}-retry-${failure.legacySurveyId}-${Date.now()}`,
            attempts: 3,
            backoff: { type: "exponential", delay: 2_000 },
          }
        )
        enqueued += 1
      }

      return { enqueued }
    } catch (err) {
      await this.orchestrator.failJob({
        migrationJobId: job.data.migrationJobId,
        correlationId: job.data.correlationId,
        error: err,
        attempt: { attemptsMade: job.attemptsMade, maxAttempts: job.opts.attempts },
      })
      throw err
    }
  }
}

@Processor(JOB_QUEUE_NAMES.etlReport)
export class EtlReportProcessor extends WorkerHost {
  private readonly logger = new Logger(EtlReportProcessor.name)

  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async process(job: Job<EtlReportPayload>) {
    if (job.name !== JOB_NAMES.generateReport) {
      throw new Error(`Unknown report job: ${job.name}`)
    }

    const migrationJob = await this.prisma.db.migrationJob.findUnique({
      where: { id: job.data.migrationJobId },
    })
    if (!migrationJob) return { ok: false }

    const startedAt = migrationJob.startedAt?.getTime() ?? migrationJob.createdAt.getTime()
    const raw = (migrationJob.statsJson as Record<string, number> | null) ?? {}
    const stats = finalizeJobStats(
      {
        imported: Number(raw.imported ?? 0),
        skipped: Number(raw.skipped ?? 0),
        duplicates: Number(raw.duplicates ?? 0),
        failed: Number(raw.failed ?? 0),
        imagesDownloaded: Number(raw.imagesDownloaded ?? 0),
        imagesUploaded: Number(raw.imagesUploaded ?? 0),
        missingImages: Number(raw.missingImages ?? 0),
      },
      startedAt
    )

    await this.prisma.db.migrationJob.update({
      where: { id: job.data.migrationJobId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        statsJson: stats,
      },
    })

    this.logger.log(JSON.stringify({ msg: "etl_report", jobId: job.data.migrationJobId, stats }))
    return stats
  }
}
