import { Body, Controller, Get, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { SkipThrottle, Throttle } from "@nestjs/throttler"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import {
  AlignWardsDto,
  CleanupEmptyStatesDto,
  ListEtlJobsQueryDto,
  ReconcileDto,
  RefreshPendingDto,
  RetryFailedDto,
  StartEtlDto,
} from "./dto/etl.dto.js"
import { EtlService } from "./etl.service.js"
import { ReconcileService } from "./reconcile.service.js"
import { WardAlignService } from "./ward-align.service.js"

@ApiTags("etl")
@ApiBearerAuth()
@Controller("etl")
export class EtlController {
  constructor(
    private readonly etlService: EtlService,
    private readonly wardAlign: WardAlignService,
    private readonly reconcileService: ReconcileService
  ) {}

  @Post("full-migration")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: "Start full Convex → Postgres/S3 migration" })
  fullMigration(@CurrentUser() user: AuthenticatedUser, @Body() body: StartEtlDto) {
    return this.etlService.startFullMigration(user.id, body.batchSize, body.force)
  }

  @Post("incremental-sync")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Import only surveys not yet in migration_state COMPLETED" })
  incrementalSync(@CurrentUser() user: AuthenticatedUser, @Body() body: StartEtlDto) {
    return this.etlService.startIncrementalSync(user.id, body.batchSize)
  }

  @Post("retry-failed")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Re-queue failed_imports under max retry" })
  retryFailed(@CurrentUser() user: AuthenticatedUser, @Body() body: RetryFailedDto) {
    return this.etlService.retryFailed(user.id, body.maxRetries)
  }

  @Post("refresh-pending")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: "Re-sync Nest surveys still PENDING QC from Convex (updates draft→submitted; never overwrites Admin QC)",
  })
  refreshPending(@CurrentUser() user: AuthenticatedUser, @Body() body: RefreshPendingDto) {
    return this.etlService.startRefreshPending(user.id, body)
  }

  @Post("reconcile-with-convex")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Read-only district parity report: Nest vs Convex surveys (no writes)" })
  reconcile(@Body() body: ReconcileDto) {
    return this.reconcileService.reconcileWithConvex(body.districtId)
  }

  @Post("align-wards-with-convex")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @SkipThrottle()
  @ApiOperation({
    summary:
      "One-click pipeline: dedupe → sync wards from Convex → cleanup empty UP shells → verify counts (dry-run or apply)",
  })
  alignWardsWithConvex(@Body() body: AlignWardsDto) {
    return this.wardAlign.alignWardsWithConvex(body.apply, body.districtId)
  }

  @Post("dedupe-wards")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Dedupe Nest wards per ULB by normalized ward number (dry-run or apply)" })
  async dedupeWards(@Body() body: AlignWardsDto) {
    const ulbIds = body.districtId ? (await this.wardAlign.getDistrictUlbAllowlist(body.districtId)).ulbIds : undefined
    return this.wardAlign.dedupeWards(body.apply, body.ulbCode, ulbIds)
  }

  @Post("sync-wards-from-convex")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Upsert Nest wards from Convex ward catalog (dry-run or apply)" })
  async syncWardsFromConvex(@Body() body: AlignWardsDto) {
    const ulbCodes = body.districtId
      ? (await this.wardAlign.getDistrictUlbAllowlist(body.districtId)).ulbCodes
      : undefined
    return this.wardAlign.syncWardsFromConvex(body.apply, { ulbCodes })
  }

  @Post("cleanup-empty-duplicate-states")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: "Delete empty duplicate UP state shells (01, UP, UP-01) when they have no districts",
  })
  cleanupEmptyDuplicateStates(@Body() body: CleanupEmptyStatesDto) {
    return this.wardAlign.cleanupEmptyDuplicateStates(body.apply)
  }

  @Post("validate")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @ApiOperation({ summary: "Validate Convex vs Postgres survey/image counts" })
  validate(@CurrentUser() user: AuthenticatedUser) {
    return this.etlService.startValidate(user.id)
  }

  @Post("reap-stale")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Close ETL jobs abandoned in QUEUED/RUNNING so new runs are not blocked" })
  async reapStale() {
    const closed = await this.etlService.reapStaleJobs()
    return { closed }
  }

  @Get("preflight")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @ApiOperation({ summary: "Diagnose the Convex ETL connection and shared secret without exposing it" })
  preflight() {
    return this.etlService.preflight()
  }

  @Get("status")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @ApiOperation({ summary: "Active ETL job + migration_state counters" })
  status() {
    return this.etlService.getStatus()
  }

  @Get("report")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @ApiOperation({ summary: "Get ETL report for a migration job" })
  report(@Query("jobId") jobId: string) {
    return this.etlService.getReport(jobId)
  }

  @Get("jobs")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @ApiOperation({ summary: "List recent ETL migration jobs" })
  jobs(@Query() query: ListEtlJobsQueryDto) {
    return this.etlService.listJobs(query.limit)
  }
}
