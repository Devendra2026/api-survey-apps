import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import {
  AssignSurveyDto,
  BulkExportSurveysDto,
  BulkRejectSurveysDto,
  BulkSurveyIdsDto,
  CreateSurveyDto,
  RejectSurveyDto,
  SurveyQueryDto,
  UpdateSurveyDto,
  WardStatsQueryDto,
} from "./dto/survey.dto.js"
import { SurveysService } from "./surveys.service.js"

@ApiTags("surveys")
@ApiBearerAuth()
@Controller("surveys")
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findAll(@Query() query: SurveyQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.findAll(query, user)
  }

  @Get("ward-stats")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  @ApiOperation({ summary: "Ward command-center cards for survey registry" })
  wardStats(@Query() query: WardStatsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.wardCommandStats(query, user)
  }

  @Post("bulk/approve")
  @RequirePermission(PERMISSIONS.SURVEY_APPROVE)
  @ApiOperation({ summary: "Bulk approve submitted surveys" })
  bulkApprove(@Body() dto: BulkSurveyIdsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.bulkApprove(dto, user)
  }

  @Post("bulk/reject")
  @RequirePermission(PERMISSIONS.SURVEY_REJECT)
  @ApiOperation({ summary: "Bulk reject submitted surveys (requires qcRemarks)" })
  bulkReject(@Body() dto: BulkRejectSurveysDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.bulkReject(dto, user)
  }

  @Post("bulk/submit")
  @RequirePermission(PERMISSIONS.SURVEY_SUBMIT)
  @ApiOperation({ summary: "Bulk submit editable surveys to QC (SUBMITTED + PENDING)" })
  bulkSubmit(@Body() dto: BulkSurveyIdsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.bulkSubmit(dto, user)
  }

  @Post("bulk/delete")
  @RequirePermission(PERMISSIONS.SURVEY_DELETE)
  @ApiOperation({ summary: "Bulk soft-delete surveys (blocks SUBMITTED and APPROVED)" })
  bulkDelete(@Body() dto: BulkSurveyIdsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.bulkDelete(dto, user)
  }

  @Post("bulk/export")
  @RequirePermission(PERMISSIONS.REPORT_EXPORT)
  @ApiOperation({ summary: "Enqueue export for selected survey ids" })
  bulkExport(@Body() dto: BulkExportSurveysDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.bulkExport(dto, user)
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  @ApiOperation({
    summary: "Survey details (Pro Max read-only view DTO)",
    description: "Accepts survey cuid or propertyId. Use DEMO-PROP-001 for glassmorphic preview mock data.",
  })
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.getSurveyDetails(id, user)
  }

  @Get(":id/history")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  @ApiOperation({ summary: "Survey audit history" })
  history(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.history(id, user)
  }

  @Get(":id/audit-history")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  @ApiOperation({
    summary: "Survey audit history (alias)",
    description: "Returns DEMO audit trail when propertyId is DEMO-PROP-001.",
  })
  auditHistory(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.getAuditHistory(id, user)
  }

  @Post()
  @RequirePermission(PERMISSIONS.SURVEY_CREATE)
  create(@Body() dto: CreateSurveyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.create(dto, user)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.SURVEY_UPDATE)
  update(@Param("id") id: string, @Body() dto: UpdateSurveyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.update(id, dto, user)
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.SURVEY_DELETE)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.softDelete(id, user)
  }

  @Post(":id/restore")
  @RequirePermission(PERMISSIONS.SURVEY_DELETE)
  @ApiOperation({ summary: "Restore a soft-deleted survey" })
  restore(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.restore(id, user)
  }

  @Post(":id/submit")
  @RequirePermission(PERMISSIONS.SURVEY_SUBMIT)
  submit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.submit(id, user)
  }

  @Post(":id/approve")
  @RequirePermission(PERMISSIONS.SURVEY_APPROVE)
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.approve(id, user)
  }

  @Post(":id/reject")
  @RequirePermission(PERMISSIONS.SURVEY_REJECT)
  reject(@Param("id") id: string, @Body() dto: RejectSurveyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.reject(id, dto, user)
  }

  @Post(":id/reopen")
  @RequirePermission(PERMISSIONS.SURVEY_UPDATE)
  @ApiOperation({ summary: "Reopen a REJECTED survey for corrections" })
  reopen(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.reopen(id, user)
  }

  @Post(":id/assign")
  @RequirePermission(PERMISSIONS.SURVEY_ASSIGN)
  @ApiOperation({ summary: "Assign survey to a surveyor" })
  assign(@Param("id") id: string, @Body() dto: AssignSurveyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.assign(id, dto.assigneeId, user)
  }
}
