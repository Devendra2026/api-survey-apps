import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import { AssignPermissionDto, CreateRoleDto, UpdateRoleDto } from "./dto/role.dto.js"
import { RolesService } from "./roles.service.js"

@ApiTags("roles")
@ApiBearerAuth()
@Controller("roles")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.USER_VIEW)
  findAll(@Query() query: PaginationQueryDto) {
    return this.rolesService.findAll(query)
  }

  @Post("permissions/assign")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  assignPermission(@Body() dto: AssignPermissionDto) {
    return this.rolesService.assignPermission(dto)
  }

  @Delete(":roleId/permissions/:permissionId")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  removePermission(@Param("roleId") roleId: string, @Param("permissionId") permissionId: string) {
    return this.rolesService.removePermission(roleId, permissionId)
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.USER_VIEW)
  findOne(@Param("id") id: string) {
    return this.rolesService.findById(id)
  }

  @Post()
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  update(@Param("id") id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto)
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  remove(@Param("id") id: string) {
    return this.rolesService.delete(id)
  }
}
