import { Body, Controller, Get, Param, Post } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { QcSurveyActionDto } from "./dto/qc-survey-action.dto.js"
import { QcService } from "./qc.service.js"

@ApiTags("qc")
@ApiBearerAuth()
@Controller("qc")
export class QcSurveyController {
  constructor(private readonly qcService: QcService) {}

  @Get("survey/:id")
  @RequirePermission(PERMISSIONS.SURVEY_APPROVE)
  @ApiOperation({ summary: "QC Review Detail — survey view + editable raw fields" })
  getSurveyDetail(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.qcService.getSurveyDetail(id, user)
  }

  @Get("survey/:id/audit-history")
  @RequirePermission(PERMISSIONS.SURVEY_APPROVE)
  @ApiOperation({ summary: "QC Review Detail — audit history timeline" })
  getAuditHistory(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.qcService.getAuditHistory(id, user)
  }

  @Post("survey/:id/action")
  @RequirePermission(PERMISSIONS.SURVEY_APPROVE)
  @ApiOperation({
    summary: "QC Review Detail — reopen / approve / reject / delete / correct",
  })
  runSurveyAction(@Param("id") id: string, @Body() dto: QcSurveyActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.qcService.runSurveyAction(id, dto, user)
  }
}
