import { Controller, Get, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { QcRegistryQueryDto } from "./dto/qc-registry.dto.js"
import { QcService } from "./qc.service.js"

@ApiTags("qc")
@ApiBearerAuth()
@Controller("qc")
export class QcRegistryController {
  constructor(private readonly qcService: QcService) {}

  @Get("registry")
  @RequirePermission(PERMISSIONS.SURVEY_APPROVE)
  @ApiOperation({ summary: "QC Review Registry list with pipeline tab counts" })
  listRegistry(@Query() query: QcRegistryQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.qcService.listRegistry(query, user)
  }
}
