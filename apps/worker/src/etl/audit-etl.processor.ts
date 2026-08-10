import { Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { CursorConflictError, loadAuditEtlConfig, runAuditEtlPipeline, verifyMigration } from "@workspace/audit-etl"
import { JOB_NAMES, JOB_QUEUE_NAMES, type AuditEtlJobPayload } from "@workspace/jobs"
import type { Job } from "bullmq"
import { UnrecoverableError } from "bullmq"
import { PrismaService } from "../database/prisma.service.js"
import { toQueueError } from "./queue-error.js"

/** Bound each cron tick so a slow backfill cannot overlap the next schedule forever. */
const DEFAULT_MAX_BATCHES_PER_TICK = 20

@Processor(JOB_QUEUE_NAMES.auditEtl, { concurrency: 1 })
export class AuditEtlProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditEtlProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {
    super()
  }

  async process(job: Job<AuditEtlJobPayload>): Promise<unknown> {
    if (job.name !== JOB_NAMES.runAuditEtl) {
      throw new Error(`Unknown audit ETL job: ${job.name}`)
    }

    const config = loadAuditEtlConfig(process.env, {
      convexSiteUrl: this.configService.get<string>("CONVEX_SITE_URL"),
      etlSecret: this.configService.get<string>("ETL_CONVEX_SECRET"),
      ...(Number.isFinite(Number.parseInt(this.configService.get<string>("AUDIT_ETL_BATCH_SIZE") ?? "", 10))
        ? {
            batchSize: Number.parseInt(this.configService.get<string>("AUDIT_ETL_BATCH_SIZE") ?? "", 10),
          }
        : {}),
    })

    const maxBatchesEnv = this.configService.get<string>("AUDIT_ETL_MAX_BATCHES_PER_TICK")
    const parsedMax = maxBatchesEnv ? Number.parseInt(maxBatchesEnv, 10) : Number.NaN
    const maxBatches = job.data.maxBatches ?? (Number.isFinite(parsedMax) ? parsedMax : DEFAULT_MAX_BATCHES_PER_TICK)

    try {
      const run = await runAuditEtlPipeline({
        prisma: this.prisma.db,
        config,
        maxBatches,
      })

      let verify: Awaited<ReturnType<typeof verifyMigration>> | null = null
      if (job.data.verify !== false) {
        const verifyEvery = this.configService.get<string>("AUDIT_ETL_VERIFY_EVERY_TICK")
        const shouldVerify = verifyEvery === "true" || job.data.verify === true
        if (shouldVerify) {
          verify = await verifyMigration({
            prisma: this.prisma.db,
            config,
            nowMs: Date.now(),
          })
        }
      }

      this.logger.log(
        `Audit ETL tick fetched=${run.fetched} upserted=${run.upserted} dlq=${run.dlq} exhausted=${run.exhausted}`
      )
      return { run, verify }
    } catch (err) {
      // Another worker already advanced the cursor — skip without burning retries.
      if (err instanceof CursorConflictError) {
        this.logger.warn(`Audit ETL cursor conflict (overlapping run): ${err.message}`)
        throw new UnrecoverableError(err.message)
      }
      throw toQueueError(err, this.logger)
    }
  }
}
