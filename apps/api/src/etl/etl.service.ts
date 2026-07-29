import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import {
  ConvexEtlHttpError,
  ConvexHttpExtractor,
  DEFAULT_ETL_BATCH_SIZE,
  DEFAULT_ETL_MAX_RETRIES,
  DEFAULT_ETL_STALE_JOB_MINUTES,
  emptyEtlJobStats,
  fingerprintSecret,
  type ConvexEtlAuthReason,
} from "@workspace/etl-core"
import { MigrationJobType } from "@workspace/database"
import { randomUUID } from "node:crypto"
import { JobsService } from "../jobs/jobs.service.js"
import { PrismaService } from "../prisma/prisma.service.js"

export interface EtlPreflightResult {
  ok: boolean
  etlEnabled: boolean
  convexSiteUrl: string | null
  secretConfigured: boolean
  /** Fingerprint of the secret this service sends; compare with Convex's logged value. */
  secretFingerprint: string
  convex: {
    reachable: boolean
    authorized?: boolean
    /** False when a proxy answered instead of Convex. */
    answeredByConvex?: boolean
    status?: number
    reason?: ConvexEtlAuthReason
    secretFingerprintSeenByConvex?: string
    sampleIds?: number
    error?: string
  }
  problems: string[]
  remediation: string[]
}

@Injectable()
export class EtlService implements OnModuleInit {
  private readonly logger = new Logger(EtlService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly config: ConfigService
  ) {}

  async onModuleInit() {
    // Runs before the enabled check so a restart always clears rows abandoned by
    // the previous process, which would otherwise block every full migration.
    try {
      const reaped = await this.reapStaleJobs()
      if (reaped > 0) this.logger.warn(`Closed ${reaped} stale ETL job(s) left behind by a previous run`)
    } catch (err) {
      this.logger.warn(`Stale ETL job sweep failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    const enabled = this.isEtlEnabled()
    if (!enabled) {
      this.logger.log("ETL scheduler disabled (ETL_ENABLED!=true)")
      return
    }
    if (!this.config.get<string>("CONVEX_SITE_URL")?.trim() || !this.config.get<string>("ETL_CONVEX_SECRET")?.trim()) {
      this.logger.warn("ETL enabled but CONVEX_SITE_URL / ETL_CONVEX_SECRET missing — cron not registered")
      return
    }
    const cron = this.config.get<string>("ETL_CRON")?.trim() || "*/15 * * * *"
    try {
      await this.jobs.scheduleIncrementalEtl(
        {
          migrationJobId: "cron-incremental",
          correlationId: "cron",
          type: "INCREMENTAL",
          cursor: null,
          batchSize: this.batchSize(),
        },
        cron
      )
      this.logger.log(`ETL incremental cron registered: ${cron}`)
    } catch (err) {
      this.logger.warn(`Failed to register ETL cron: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async startFullMigration(userId: string, batchSize?: number, force?: boolean) {
    this.assertEtlConfigured()
    if (!force) {
      // Sweep first so an abandoned row does not masquerade as an in-flight run.
      await this.reapStaleJobs()
      const running = await this.prisma.db.migrationJob.findFirst({
        where: { status: { in: ["QUEUED", "RUNNING"] }, type: MigrationJobType.FULL },
      })
      if (running) {
        throw new BadRequestException(
          `Full migration already running: ${running.id} (last progress ${running.updatedAt.toISOString()}). ` +
            `Pass force=true to start anyway.`
        )
      }
    }
    return this.startJob(MigrationJobType.FULL, "FULL", userId, batchSize, null, force)
  }

  async startIncrementalSync(userId: string, batchSize?: number) {
    this.assertEtlConfigured()
    return this.startJob(MigrationJobType.INCREMENTAL, "INCREMENTAL", userId, batchSize, null)
  }

  async retryFailed(userId: string, maxRetries?: number) {
    this.assertEtlConfigured()
    const correlationId = randomUUID()
    const migrationJob = await this.prisma.db.migrationJob.create({
      data: {
        type: MigrationJobType.RETRY_FAILED,
        status: "QUEUED",
        batchSize: this.batchSize(),
        correlationId,
        createdById: userId,
        statsJson: emptyEtlJobStats(),
      },
    })
    await this.jobs.enqueueEtlRetry({
      migrationJobId: migrationJob.id,
      correlationId,
      maxRetries: maxRetries ?? DEFAULT_ETL_MAX_RETRIES,
      createdById: userId,
    })
    return { jobId: migrationJob.id, correlationId }
  }

  async startValidate(userId: string) {
    this.assertEtlConfigured()
    const correlationId = randomUUID()
    const migrationJob = await this.prisma.db.migrationJob.create({
      data: {
        type: MigrationJobType.VALIDATE,
        status: "QUEUED",
        batchSize: this.batchSize(),
        correlationId,
        createdById: userId,
        statsJson: {},
      },
    })
    await this.jobs.enqueueEtlValidate({
      migrationJobId: migrationJob.id,
      correlationId,
      createdById: userId,
    })
    return { jobId: migrationJob.id, correlationId }
  }

  /**
   * Closes QUEUED/RUNNING jobs that have made no progress for the stale window.
   * Every batch advances `updatedAt` (cursor or stats), so a quiet row means the
   * worker died, was redeployed, or gave up without closing the row.
   */
  async reapStaleJobs(): Promise<number> {
    const cutoff = new Date(Date.now() - this.staleJobTimeoutMs())
    const stale = await this.prisma.db.migrationJob.findMany({
      where: { status: { in: ["QUEUED", "RUNNING"] }, updatedAt: { lt: cutoff } },
      select: { id: true, statsJson: true, updatedAt: true },
    })

    for (const job of stale) {
      const stats: Record<string, string | number> = {}
      for (const [key, value] of Object.entries((job.statsJson as Record<string, unknown> | null) ?? {})) {
        if (typeof value === "number" || typeof value === "string") stats[key] = value
      }
      stats.error = `Abandoned: no progress since ${job.updatedAt.toISOString()}`
      await this.prisma.db.migrationJob.update({
        where: { id: job.id },
        data: { status: "FAILED", finishedAt: new Date(), statsJson: stats },
      })
    }

    return stale.length
  }

  /**
   * Read-only end-to-end check of the Convex ETL link. Reports the fingerprint of
   * the secret this service would send so it can be compared against the one
   * Convex logs, without either side ever exposing the value.
   */
  async preflight(): Promise<EtlPreflightResult> {
    const siteUrl = this.config.get<string>("CONVEX_SITE_URL")?.trim() ?? ""
    const secret = this.config.get<string>("ETL_CONVEX_SECRET")?.trim() ?? ""
    const problems: string[] = []
    const remediation: string[] = []

    if (!this.isEtlEnabled()) problems.push("ETL_ENABLED is not 'true', so the incremental cron is not registered")
    if (!siteUrl) {
      problems.push("CONVEX_SITE_URL is not set")
      remediation.push("Set CONVEX_SITE_URL to the Convex site (HTTP actions) origin")
    }
    if (!secret) {
      problems.push("ETL_CONVEX_SECRET is not set")
      remediation.push("Set ETL_CONVEX_SECRET to the same value as Convex ETL_SECRET")
    }

    const result: EtlPreflightResult = {
      ok: false,
      etlEnabled: this.isEtlEnabled(),
      convexSiteUrl: siteUrl || null,
      secretConfigured: secret.length > 0,
      secretFingerprint: await fingerprintSecret(secret),
      convex: { reachable: false },
      problems,
      remediation,
    }

    if (siteUrl && secret) {
      const extractor = new ConvexHttpExtractor({ siteUrl, etlSecret: secret })
      try {
        // Cheapest authenticated call: exercises the secret without scanning surveys.
        const page = await extractor.listSurveyIds({ cursor: null, numItems: 1 })
        result.convex = { reachable: true, authorized: true, answeredByConvex: true, sampleIds: page.ids.length }
      } catch (err) {
        if (err instanceof ConvexEtlHttpError) {
          result.convex = {
            reachable: true,
            authorized: false,
            answeredByConvex: err.answeredByConvex,
            status: err.status,
            reason: err.reason,
            secretFingerprintSeenByConvex: err.providedFingerprint,
          }
          problems.push(`Convex rejected the ETL call with ${err.status}${err.reason ? ` (${err.reason})` : ""}`)
          remediation.push(err.remediation)
        } else {
          const message = err instanceof Error ? err.message : String(err)
          result.convex = { reachable: false, authorized: false, error: message.slice(0, 300) }
          problems.push(`Could not reach ${siteUrl}: ${message.slice(0, 200)}`)
          remediation.push("Check DNS, TLS, and that the Convex deployment is running")
        }
      }
    }

    result.ok = problems.length === 0
    return result
  }

  async getStatus() {
    const active = await this.prisma.db.migrationJob.findFirst({
      where: { status: { in: ["QUEUED", "RUNNING"] } },
      orderBy: { createdAt: "desc" },
    })
    const completed = await this.prisma.db.migrationState.count({ where: { status: "COMPLETED" } })
    const failed = await this.prisma.db.migrationState.count({ where: { status: "FAILED" } })
    const pending = await this.prisma.db.migrationState.count({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    })
    return {
      etlEnabled: this.isEtlEnabled(),
      activeJob: active,
      migrationState: { completed, failed, pending },
    }
  }

  async getReport(jobId: string) {
    const job = await this.prisma.db.migrationJob.findUnique({ where: { id: jobId } })
    if (!job) throw new NotFoundException(`Migration job ${jobId} not found`)
    return {
      jobId: job.id,
      type: job.type,
      status: job.status,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      cursor: job.cursor,
      stats: job.statsJson,
      correlationId: job.correlationId,
    }
  }

  async listJobs(limit = 20) {
    const jobs = await this.prisma.db.migrationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    })
    return { items: jobs }
  }

  private async startJob(
    prismaType: MigrationJobType,
    queueType: "FULL" | "INCREMENTAL",
    userId: string,
    batchSize: number | undefined,
    cursor: string | null,
    force?: boolean
  ) {
    const correlationId = randomUUID()
    const size = batchSize ?? this.batchSize()
    const migrationJob = await this.prisma.db.migrationJob.create({
      data: {
        type: prismaType,
        status: "QUEUED",
        batchSize: size,
        cursor,
        correlationId,
        createdById: userId,
        statsJson: emptyEtlJobStats(),
      },
    })

    await this.jobs.enqueueEtlSurveyBatch({
      migrationJobId: migrationJob.id,
      correlationId,
      type: queueType,
      cursor,
      batchSize: size,
      force,
      createdById: userId,
    })

    return { jobId: migrationJob.id, correlationId }
  }

  private batchSize() {
    return Number(this.config.get("ETL_BATCH_SIZE") ?? DEFAULT_ETL_BATCH_SIZE)
  }

  private staleJobTimeoutMs() {
    const minutes = Number(this.config.get("ETL_STALE_JOB_TIMEOUT_MINUTES") ?? DEFAULT_ETL_STALE_JOB_MINUTES)
    return (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_ETL_STALE_JOB_MINUTES) * 60_000
  }

  private isEtlEnabled() {
    return (this.config.get<string>("ETL_ENABLED") ?? "").toLowerCase() === "true"
  }

  private assertEtlConfigured() {
    if (!this.config.get<string>("CONVEX_SITE_URL")?.trim()) {
      throw new ServiceUnavailableException("CONVEX_SITE_URL is not configured")
    }
    if (!this.config.get<string>("ETL_CONVEX_SECRET")?.trim()) {
      throw new ServiceUnavailableException("ETL_CONVEX_SECRET is not configured")
    }
  }
}
