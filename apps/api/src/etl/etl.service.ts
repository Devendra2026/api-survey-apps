import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { DEFAULT_ETL_BATCH_SIZE, DEFAULT_ETL_MAX_RETRIES, emptyEtlJobStats } from "@workspace/etl-core"
import { MigrationJobType } from "@workspace/database"
import { randomUUID } from "node:crypto"
import { JobsService } from "../jobs/jobs.service.js"
import { PrismaService } from "../prisma/prisma.service.js"

@Injectable()
export class EtlService implements OnModuleInit {
  private readonly logger = new Logger(EtlService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly config: ConfigService
  ) {}

  async onModuleInit() {
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
      const running = await this.prisma.db.migrationJob.findFirst({
        where: { status: { in: ["QUEUED", "RUNNING"] }, type: MigrationJobType.FULL },
      })
      if (running) {
        throw new BadRequestException(`Full migration already running: ${running.id}`)
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
