import { Controller, Get, Query, UseGuards } from "@nestjs/common"
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger"
import { Public } from "../common/decorators/public.decorator.js"
import { UlbId } from "../common/decorators/ulb-id.decorator.js"
import { UlbApiKeyGuard } from "../common/guards/ulb-api-key.guard.js"
import { PortalSurveyQueryDto } from "./dto/portal-survey-query.dto.js"
import { PortalSurveysService } from "./portal-surveys.service.js"

@ApiTags("portal")
@ApiHeader({ name: "X-API-Key", required: true })
@Public()
@UseGuards(UlbApiKeyGuard)
@Controller("v1/portal")
export class PortalSurveysController {
  constructor(private readonly portalSurveysService: PortalSurveysService) {}

  @Get("surveys")
  @ApiOperation({ summary: "Paginated survey summary for the ULB bound to the API key" })
  findAll(@UlbId() ulbId: string, @Query() query: PortalSurveyQueryDto) {
    return this.portalSurveysService.findAll(ulbId, query)
  }
}
