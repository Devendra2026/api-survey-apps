import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { CreateStateDto, UpdateStateDto } from "./dto/geo.dto.js"
import { StatesService } from "./states.service.js"

@ApiTags("states")
@ApiBearerAuth()
@Controller("states")
export class StatesController {
  constructor(private readonly statesService: StatesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SETTINGS_VIEW)
  findAll(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.statesService.findAll(query, user)
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.SETTINGS_VIEW)
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.statesService.findById(id, user)
  }

  @Post()
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  create(@Body() dto: CreateStateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.statesService.create(dto, user.id)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  update(@Param("id") id: string, @Body() dto: UpdateStateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.statesService.update(id, dto, user)
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.statesService.delete(id, user)
  }
}
