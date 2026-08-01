import { Controller, Get, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { QcQueueByParcelQueryDto, QcQueueFirstQueryDto, QcQueueNeighborsQueryDto } from "./dto/qc-queue.dto.js"
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

  @Get("queue/first")
  @RequirePermission(PERMISSIONS.SURVEY_APPROVE)
  @ApiOperation({ summary: "First pending QC parcel in a ward (parcelNumber ASC)" })
  findQueueFirst(@Query() query: QcQueueFirstQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.qcService.findQueueFirst(query.wardId, user)
  }

  @Get("queue/neighbors")
  @RequirePermission(PERMISSIONS.SURVEY_APPROVE)
  @ApiOperation({ summary: "Previous/next pending QC parcels in active ward" })
  findQueueNeighbors(@Query() query: QcQueueNeighborsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.qcService.findQueueNeighbors(query.wardId, query.surveyId, user)
  }

  @Get("queue/by-parcel")
  @RequirePermission(PERMISSIONS.SURVEY_APPROVE)
  @ApiOperation({ summary: "Find pending QC parcel by parcel number in active ward" })
  findQueueByParcel(@Query() query: QcQueueByParcelQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.qcService.findQueueByParcel(query.wardId, query.parcelNumber, user)
  }
}
