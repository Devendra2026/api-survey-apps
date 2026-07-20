import { Controller, Get, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { ConfigurationGeographyService } from "./configuration-geography.service.js"

@ApiTags("configuration-geography")
@ApiBearerAuth()
@Controller("configuration/geography")
export class ConfigurationGeographyController {
  constructor(private readonly geographyService: ConfigurationGeographyService) {}

  @Get("tree")
  @RequirePermission(PERMISSIONS.SETTINGS_VIEW)
  tree(@Query("stateId") stateId?: string) {
    return this.geographyService.getTree(stateId)
  }
}
