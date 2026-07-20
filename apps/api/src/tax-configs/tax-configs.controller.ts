import { Body, Controller, Get, Param, Patch, Post, Put, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import {
  PublishTaxConfigDto,
  RollbackTaxConfigDto,
  TaxPreviewDto,
  UpdateTaxConfigParamsDto,
  UpsertTaxCellsDto,
} from "./dto/tax-config.dto.js"
import { TaxConfigsService } from "./tax-configs.service.js"

@ApiTags("tax-configs")
@ApiBearerAuth()
@Controller("tax-configs")
export class TaxConfigsController {
  constructor(private readonly taxConfigsService: TaxConfigsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SETTINGS_VIEW)
  getOrCreate(
    @Query("wardId") wardId: string,
    @Query("assessmentYearId") assessmentYearId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.taxConfigsService.getOrCreate(wardId, assessmentYearId, user.id)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  updateParams(@Param("id") id: string, @Body() dto: UpdateTaxConfigParamsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.taxConfigsService.updateParams(id, dto, user.id)
  }

  @Put(":id/cells")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  upsertCells(@Param("id") id: string, @Body() dto: UpsertTaxCellsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.taxConfigsService.upsertCells(id, dto.cells ?? [], user.id)
  }

  @Post("preview")
  @RequirePermission(PERMISSIONS.SETTINGS_VIEW)
  preview(@Body() dto: TaxPreviewDto) {
    return this.taxConfigsService.preview(dto)
  }

  @Get(":id/versions")
  @RequirePermission(PERMISSIONS.SETTINGS_VIEW)
  versions(@Param("id") id: string) {
    return this.taxConfigsService.listVersions(id)
  }

  @Post(":id/publish")
  @RequirePermission(PERMISSIONS.SETTINGS_PUBLISH)
  publish(@Param("id") id: string, @Body() dto: PublishTaxConfigDto, @CurrentUser() user: AuthenticatedUser) {
    return this.taxConfigsService.publish(id, dto, user.id)
  }

  @Post(":id/rollback")
  @RequirePermission(PERMISSIONS.SETTINGS_PUBLISH)
  rollback(@Param("id") id: string, @Body() dto: RollbackTaxConfigDto, @CurrentUser() user: AuthenticatedUser) {
    return this.taxConfigsService.rollback(id, dto, user.id)
  }
}
