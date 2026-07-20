import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import {
  AssignPermissionDto,
  CloneRoleDto,
  CreateRoleDto,
  SetRolePermissionsDto,
  UpdateRoleDto,
} from "./dto/role.dto.js"
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

  @Put(":id/permissions")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  @ApiOperation({ summary: "Replace the full permission set for a role (matrix save)" })
  setPermissions(@Param("id") id: string, @Body() dto: SetRolePermissionsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.setPermissions(id, dto, user)
  }

  @Get(":id/users")
  @RequirePermission(PERMISSIONS.USER_VIEW)
  @ApiOperation({ summary: "List users currently assigned this role" })
  listUsers(@Param("id") id: string) {
    return this.rolesService.listUsersForRole(id)
  }

  @Get(":id/audits")
  @RequirePermission(PERMISSIONS.USER_VIEW)
  @ApiOperation({ summary: "List permission-change audit events for a role" })
  listAudits(@Param("id") id: string) {
    return this.rolesService.listAudits(id)
  }

  @Post(":id/clone")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  @ApiOperation({ summary: "Clone a role and its permissions" })
  clone(@Param("id") id: string, @Body() dto: CloneRoleDto) {
    return this.rolesService.clone(id, dto)
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
