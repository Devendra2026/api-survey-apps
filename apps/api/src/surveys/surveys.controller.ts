import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { CreateSurveyDto, RejectSurveyDto, SurveyQueryDto, UpdateSurveyDto } from "./dto/survey.dto.js"
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

  @Get(":id")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.findById(id, user)
  }

  @Get(":id/history")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  @ApiOperation({ summary: "Survey audit history" })
  history(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surveysService.history(id, user)
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
}
