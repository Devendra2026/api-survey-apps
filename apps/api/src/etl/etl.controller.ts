import { Body, Controller, Get, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { ListEtlJobsQueryDto, RetryFailedDto, StartEtlDto } from "./dto/etl.dto.js"
import { EtlService } from "./etl.service.js"

@ApiTags("etl")
@ApiBearerAuth()
@Controller("etl")
export class EtlController {
  constructor(private readonly etlService: EtlService) {}

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

  @Post("validate")
  @RequirePermission(PERMISSIONS.ETL_MANAGE)
  @ApiOperation({ summary: "Validate Convex vs Postgres survey/image counts" })
  validate(@CurrentUser() user: AuthenticatedUser) {
    return this.etlService.startValidate(user.id)
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
