import { Controller, Get, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { QcFiltersDto } from "./dto/qc-filters.dto.js"
import { QcService } from "./qc.service.js"

@ApiTags("qc")
@ApiBearerAuth()
@Controller("qc")
export class QcController {
  constructor(private readonly qcService: QcService) {}

  @Get("metrics")
  @RequirePermission(PERMISSIONS.SURVEY_APPROVE)
  @ApiOperation({ summary: "QC Command Center pipeline + KPI metrics" })
  getMetrics(@Query() filters: QcFiltersDto, @CurrentUser() user: AuthenticatedUser) {
    return this.qcService.getMetrics(filters, user)
  }

  @Get("wards")
  @RequirePermission(PERMISSIONS.SURVEY_APPROVE)
  @ApiOperation({ summary: "QC Command Center ward-wise review cards" })
  getWards(@Query() filters: QcFiltersDto, @CurrentUser() user: AuthenticatedUser) {
    return this.qcService.getWards(filters, user)
  }
}
