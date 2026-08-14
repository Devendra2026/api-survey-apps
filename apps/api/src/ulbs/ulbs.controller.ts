import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from "@nestjs/swagger"
import { IsOptional, IsString } from "class-validator"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequireAnyPermission, RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { CreateUlbDto, UpdateUlbDto } from "../states/dto/geo.dto.js"
import { UlbsService } from "./ulbs.service.js"

const GEO_READ = [
  PERMISSIONS.SETTINGS_VIEW,
  PERMISSIONS.SETTINGS_MANAGE,
  PERMISSIONS.ROLE_ASSIGN,
  PERMISSIONS.SURVEY_VIEW,
] as const

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

  @Get(":id/api-keys/current")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: "Active portal API key metadata (prefix only)" })
  currentApiKey(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ulbsService.getCurrentApiKey(id, user)
  }

  @Post(":id/api-keys")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: "Generate or rotate the ULB portal API key (raw key returned once)" })
  rotateApiKey(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ulbsService.rotateApiKey(id, user)
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
