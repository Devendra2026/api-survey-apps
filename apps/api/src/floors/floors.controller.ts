import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from "@nestjs/swagger"
import { IsOptional, IsString } from "class-validator"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { CreateFloorDto, UpdateFloorDto } from "./dto/related.dto.js"
import { FloorsService } from "./floors.service.js"

class FloorQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  surveyId?: string
}

@ApiTags("floors")
@ApiBearerAuth()
@Controller("floors")
export class FloorsController {
  constructor(private readonly floorsService: FloorsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findAll(@Query() query: FloorQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.floorsService.findAll(query, user, query.surveyId)
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.floorsService.findById(id, user)
  }

  @Post()
  @RequirePermission(PERMISSIONS.SURVEY_UPDATE)
  create(@Body() dto: CreateFloorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.floorsService.create(dto, user)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.SURVEY_UPDATE)
  update(@Param("id") id: string, @Body() dto: UpdateFloorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.floorsService.update(id, dto, user)
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.SURVEY_UPDATE)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.floorsService.delete(id, user)
  }
}
