import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from "@nestjs/swagger"
import { IsOptional, IsString } from "class-validator"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequireAnyPermission, RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { CreateUlbDto, UpdateUlbDto } from "../states/dto/geo.dto.js"
import { UlbsService } from "./ulbs.service.js"

const GEO_READ = [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.ROLE_ASSIGN, PERMISSIONS.SURVEY_VIEW] as const

class UlbQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  districtId?: string
}

@ApiTags("ulbs")
@ApiBearerAuth()
@Controller("ulbs")
export class UlbsController {
  constructor(private readonly ulbsService: UlbsService) {}

  @Get()
  @RequireAnyPermission(...GEO_READ)
  findAll(@Query() query: UlbQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ulbsService.findAll(query, user, query.districtId)
  }

  @Get(":id")
  @RequireAnyPermission(...GEO_READ)
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ulbsService.findById(id, user)
  }

  @Post()
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  create(@Body() dto: CreateUlbDto) {
    return this.ulbsService.create(dto)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  update(@Param("id") id: string, @Body() dto: UpdateUlbDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ulbsService.update(id, dto, user)
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ulbsService.delete(id, user)
  }
}
