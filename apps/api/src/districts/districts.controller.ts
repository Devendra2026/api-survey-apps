import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from "@nestjs/swagger"
import { IsOptional, IsString } from "class-validator"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { CreateDistrictDto, UpdateDistrictDto } from "../states/dto/geo.dto.js"
import { DistrictsService } from "./districts.service.js"

class DistrictQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stateId?: string
}

@ApiTags("districts")
@ApiBearerAuth()
@Controller("districts")
export class DistrictsController {
  constructor(private readonly districtsService: DistrictsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findAll(@Query() query: DistrictQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.districtsService.findAll(query, user, query.stateId)
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.districtsService.findById(id, user)
  }

  @Post()
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  create(@Body() dto: CreateDistrictDto) {
    return this.districtsService.create(dto)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  update(@Param("id") id: string, @Body() dto: UpdateDistrictDto, @CurrentUser() user: AuthenticatedUser) {
    return this.districtsService.update(id, dto, user)
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.districtsService.delete(id, user)
  }
}
