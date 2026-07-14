import { Controller, Get, Query, Res, StreamableFile } from "@nestjs/common"
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
    enum: ["surveys", "ward", "ulb", "district", "summary"],
    default: "surveys",
  })
  @IsOptional()
  @IsIn(["surveys", "ward", "ulb", "district", "summary"])
  reportType: ExportReportType = "surveys"

  @ApiPropertyOptional({ enum: SurveyStatus })
  @IsOptional()
  @IsEnum(SurveyStatus)
  surveyStatus?: SurveyStatus

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
  @ApiOperation({ summary: "Legacy JSON export of surveys" })
  exportLegacy(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.exportSurveys(user)
  }

  @Get("export")
  @RequirePermission(PERMISSIONS.REPORT_EXPORT)
  @ApiOperation({ summary: "Export surveys as JSON, Excel, CSV, or PDF" })
  async export(
    @Query() query: ExportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response
  ) {
    const filters = {
      surveyStatus: query.surveyStatus,
      stateId: query.stateId,
      districtId: query.districtId,
      ulbId: query.ulbId,
      wardId: query.wardId,
      search: query.search,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
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
}
