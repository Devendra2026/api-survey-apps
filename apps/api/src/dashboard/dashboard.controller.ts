import { Controller, Get } from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { DashboardService } from "./dashboard.service.js"

@ApiTags("dashboard")
@ApiBearerAuth()
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  @RequirePermission(PERMISSIONS.DASHBOARD_VIEW)
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getSummary(user)
  }

  @Get("organization")
  @RequirePermission(PERMISSIONS.DASHBOARD_VIEW)
  organization(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getOrganization(user)
  }

  @Get("analytics")
  @RequirePermission(PERMISSIONS.DASHBOARD_VIEW)
  analytics(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getAnalytics(user)
  }
}
