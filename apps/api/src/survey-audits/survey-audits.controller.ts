import { Controller, Get, Param, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from "@nestjs/swagger"
import { IsOptional, IsString } from "class-validator"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { SurveyAuditsService } from "./survey-audits.service.js"

class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  surveyId?: string
}

@ApiTags("survey-audits")
@ApiBearerAuth()
@Controller("survey-audits")
export class SurveyAuditsController {
  constructor(private readonly surveyAuditsService: SurveyAuditsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findAll(@Query() query: AuditQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveyAuditsService.findAll(query, user, query.surveyId)
  }

  @Get("by-survey/:surveyId")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findBySurvey(@Param("surveyId") surveyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.surveyAuditsService.findBySurvey(surveyId, user)
  }
}
