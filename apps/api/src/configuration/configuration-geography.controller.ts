import { Controller, Get, Param, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { RequireAnyPermission } from "../common/decorators/require-permission.decorator.js"
import { ConfigurationGeographyService } from "./configuration-geography.service.js"

@ApiTags("configuration-geography")
@ApiBearerAuth()
@Controller("configuration/geography")
export class ConfigurationGeographyController {
  constructor(private readonly geographyService: ConfigurationGeographyService) {}

  @Get("tree")
  @RequireAnyPermission(PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_MANAGE)
  tree(@Query("stateId") stateId?: string) {
    return this.geographyService.getTree(stateId)
  }

  /** Unscoped ward list for Master Data (matches tree counts). */
  @Get("ulbs/:ulbId/wards")
  @RequireAnyPermission(PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_MANAGE)
  wardsForUlb(@Param("ulbId") ulbId: string) {
    return this.geographyService.listWardsForUlb(ulbId)
  }
}
