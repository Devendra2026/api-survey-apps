import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import { CreatePermissionDto, UpdatePermissionDto } from "../roles/dto/role.dto.js"
import { PermissionsService } from "./permissions.service.js"

@ApiTags("permissions")
@ApiBearerAuth()
@Controller("permissions")
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.USER_VIEW)
  findAll(@Query() query: PaginationQueryDto) {
    return this.permissionsService.findAll(query)
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.USER_VIEW)
  findOne(@Param("id") id: string) {
    return this.permissionsService.findById(id)
  }

  @Post()
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  update(@Param("id") id: string, @Body() dto: UpdatePermissionDto) {
    return this.permissionsService.update(id, dto)
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  remove(@Param("id") id: string) {
    return this.permissionsService.delete(id)
  }
}
