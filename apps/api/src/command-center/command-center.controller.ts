import { Controller, Get, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { CommandCenterService } from "./command-center.service.js"
import { CommandCenterFiltersDto } from "./dto/command-center-filters.dto.js"

@ApiTags("command-center")
@ApiBearerAuth()
@Controller("command-center")
export class CommandCenterController {
  constructor(private readonly commandCenterService: CommandCenterService) {}

  @Get("kpis")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  @ApiOperation({ summary: "Survey Command Center KPI aggregates" })
  getAggregatedKPIs(@Query() filters: CommandCenterFiltersDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commandCenterService.getAggregatedKPIs(filters, user)
  }

  @Get("wards")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  @ApiOperation({ summary: "Ward-wise survey progress cards" })
  getWardWiseData(@Query() filters: CommandCenterFiltersDto, @CurrentUser() user: AuthenticatedUser) {
    return this.commandCenterService.getWardWiseData(filters, user)
  }
}
