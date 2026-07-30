import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from "@nestjs/swagger"
import { IsOptional, IsString } from "class-validator"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequireAnyPermission, RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { CreateWardDto, UpdateWardDto } from "../states/dto/geo.dto.js"
import { WardsService } from "./wards.service.js"

const GEO_READ = [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.ROLE_ASSIGN, PERMISSIONS.SURVEY_VIEW] as const

class WardQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ulbId?: string
}

@ApiTags("wards")
@ApiBearerAuth()
@Controller("wards")
export class WardsController {
  constructor(private readonly wardsService: WardsService) {}

  @Get()
  @RequireAnyPermission(...GEO_READ)
  findAll(@Query() query: WardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.wardsService.findAll(query, user, query.ulbId)
  }

  @Get(":id")
  @RequireAnyPermission(...GEO_READ)
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.wardsService.findById(id, user)
  }

  @Post()
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  create(@Body() dto: CreateWardDto) {
    return this.wardsService.create(dto)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  update(@Param("id") id: string, @Body() dto: UpdateWardDto, @CurrentUser() user: AuthenticatedUser) {
    return this.wardsService.update(id, dto, user)
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.wardsService.delete(id, user)
  }
}
