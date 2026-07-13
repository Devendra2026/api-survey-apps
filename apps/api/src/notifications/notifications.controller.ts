import { Controller, Get, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { NotificationsService } from "./notifications.service.js"

@ApiTags("notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.DASHBOARD_VIEW)
  @ApiOperation({ summary: "List workflow notifications derived from survey audit events" })
  findAll(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.findAll(user, query)
  }

  @Get("unread-count")
  @RequirePermission(PERMISSIONS.DASHBOARD_VIEW)
  @ApiOperation({ summary: "Count recent workflow notifications (last 7 days)" })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnreadCount(user)
  }
}
