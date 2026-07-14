import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from "@nestjs/swagger"
import { IsOptional, IsString } from "class-validator"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { CreateUlbDto, UpdateUlbDto } from "../states/dto/geo.dto.js"
import { UlbsService } from "./ulbs.service.js"

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
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findAll(@Query() query: UlbQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ulbsService.findAll(query, user, query.districtId)
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ulbsService.findById(id, user)
  }

  @Post()
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  create(@Body() dto: CreateUlbDto) {
    return this.ulbsService.create(dto)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  update(@Param("id") id: string, @Body() dto: UpdateUlbDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ulbsService.update(id, dto, user)
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ulbsService.delete(id, user)
  }
}
