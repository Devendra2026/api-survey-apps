import { Controller, Get, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { ConfigAuditService } from "./config-audit.service.js"

@ApiTags("configuration-audit")
@ApiBearerAuth()
@Controller("configuration/audit")
export class ConfigAuditController {
  constructor(private readonly configAuditService: ConfigAuditService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SETTINGS_VIEW)
  list(@Query("entityType") entityType?: string, @Query("entityId") entityId?: string, @Query("limit") limit?: string) {
    return this.configAuditService.list({
      entityType,
      entityId,
      limit: limit ? Number(limit) : undefined,
    })
  }
}
