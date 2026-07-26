import { Controller, Get, Param, Query, Res, StreamableFile } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from "@nestjs/swagger"
import { SurveyStatus } from "@workspace/database"
import { IsBooleanString, IsDateString, IsEnum, IsIn, IsOptional, IsString } from "class-validator"
import type { Response } from "express"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import type { ExportFormat, ExportReportType } from "./export.types.js"
import { ReportsService } from "./reports.service.js"

class ReportQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SurveyStatus })
  @IsOptional()
  @IsEnum(SurveyStatus)
  surveyStatus?: SurveyStatus

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ulbId?: string
}

class ExportQueryDto {
  @ApiPropertyOptional({ enum: ["json", "xlsx", "csv", "pdf"], default: "xlsx" })
  @IsOptional()
  @IsIn(["json", "xlsx", "csv", "pdf"])
  format: ExportFormat = "xlsx"

  @ApiPropertyOptional({
    enum: [
      "surveys",
      "ward",
      "ulb",
      "district",
      "summary",
      "convex_full",
      "survey_data",
      "nagar_panchayat",
      "qc_final",
      "demand_notices",
    ],
    default: "surveys",
  })
  @IsOptional()
  @IsIn([
    "surveys",
    "ward",
    "ulb",
    "district",
    "summary",
    "convex_full",
    "survey_data",
    "nagar_panchayat",
    "qc_final",
    "demand_notices",
  ])
  reportType: ExportReportType = "surveys"

  @ApiPropertyOptional({ enum: SurveyStatus })
  @IsOptional()
  @IsEnum(SurveyStatus)
  surveyStatus?: SurveyStatus

  @ApiPropertyOptional({ enum: ["PENDING", "APPROVED", "REJECTED"] })
  @IsOptional()
  @IsIn(["PENDING", "APPROVED", "REJECTED"])
  qcStatus?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  surveyorId?: string

  @ApiPropertyOptional({ description: "Comma-separated survey IDs" })
  @IsOptional()
  @IsString()
  selectedIds?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stateId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  districtId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ulbId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wardId?: string

  @ApiPropertyOptional({ description: "ReferenceEntry id for ASSESSMENT_YEAR (demand_notices)" })
  @IsOptional()
  @IsString()
  assessmentYearId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string

  @ApiPropertyOptional({ description: "Run immediately for small exports only", default: "false" })
  @IsOptional()
  @IsBooleanString()
  sync?: string
}

@ApiTags("reports")
@ApiBearerAuth()
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("surveys")
  @RequirePermission(PERMISSIONS.REPORT_VIEW)
  surveys(@Query() query: ReportQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.surveyReport(user, query)
  }

  @Get("surveys/export")
  @RequirePermission(PERMISSIONS.REPORT_EXPORT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Legacy JSON export of surveys" })
  exportLegacy(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.exportSurveys(user)
  }

  @Get("export")
  @RequirePermission(PERMISSIONS.REPORT_EXPORT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Export surveys as JSON, Excel, CSV, or PDF" })
  async export(
    @Query() query: ExportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response
  ) {
    const filters = {
      surveyStatus: query.surveyStatus,
      qcStatus: query.qcStatus,
      stateId: query.stateId,
      districtId: query.districtId,
      ulbId: query.ulbId,
      wardId: query.wardId,
      surveyorId: query.surveyorId,
      selectedIds: query.selectedIds?.split(",").filter(Boolean),
      search: query.search,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      assessmentYearId: query.assessmentYearId,
    }

    if (query.sync !== "true") {
      return this.reportsService.enqueueExport(user, query.format, query.reportType, filters)
    }

    const result = await this.reportsService.exportSync(user, query.format, query.reportType, filters)

    if ("buffer" in result) {
      res.setHeader("Content-Type", result.contentType)
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`)
      return new StreamableFile(result.buffer)
    }

    return result
  }

  @Get("nagar-panchayat")
  @RequirePermission(PERMISSIONS.REPORT_EXPORT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Queue the Bakewar-compatible Nagar Panchayat Excel preset" })
  nagarPanchayat(@Query() query: ExportQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.enqueueExport(user, "xlsx", "nagar_panchayat", {
      surveyStatus: query.surveyStatus,
      qcStatus: query.qcStatus,
      stateId: query.stateId,
      districtId: query.districtId,
      ulbId: query.ulbId,
      wardId: query.wardId,
      surveyorId: query.surveyorId,
      selectedIds: query.selectedIds?.split(",").filter(Boolean),
      search: query.search,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    })
  }

  @Get("jobs/:id/download")
  @RequirePermission(PERMISSIONS.REPORT_EXPORT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Get a signed URL for a completed export job" })
  downloadJob(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getJobDownload(user, id)
  }

  @Get("jobs/:id")
  @RequirePermission(PERMISSIONS.REPORT_EXPORT)
  @ApiOperation({ summary: "Get status for an export job owned by the current user" })
  getJob(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getJob(user, id)
  }
}
