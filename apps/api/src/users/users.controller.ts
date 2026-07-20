import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { AssignTenantRoleDto, CreateUserDto, ListUsersQueryDto, SyncUserDto, UpdateUserDto } from "./dto/user.dto.js"
import { UsersService } from "./users.service.js"

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Get current authenticated user profile" })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user)
  }

  @Post("sync")
  @ApiOperation({ summary: "Sync profile fields from client after Clerk login" })
  sync(@CurrentUser() user: AuthenticatedUser, @Body() dto: SyncUserDto) {
    return this.usersService.sync(user, dto)
  }

  @Get("stats")
  @RequirePermission(PERMISSIONS.USER_VIEW)
  @ApiOperation({ summary: "User directory KPI counts" })
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getStats(user)
  }

  @Get(":id/audits")
  @RequirePermission(PERMISSIONS.USER_VIEW)
  @ApiOperation({ summary: "Security audit events for a user" })
  getAudits(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getAudits(id, user)
  }

  @Get()
  @RequirePermission(PERMISSIONS.USER_VIEW)
  findAll(@Query() query: ListUsersQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findAll(query, user)
  }

  @Post("tenant-roles/assign")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  assignTenantRole(@CurrentUser() user: AuthenticatedUser, @Body() dto: AssignTenantRoleDto) {
    return this.usersService.assignTenantRole(dto, user)
  }

  @Delete("tenant-roles/:id")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  deactivateTenantRole(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deactivateTenantRole(id, user)
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.USER_VIEW)
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(id, user)
  }

  @Post()
  @RequirePermission(PERMISSIONS.USER_CREATE)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.USER_UPDATE)
  update(@Param("id") id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.update(id, dto, user)
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.USER_DELETE)
  @ApiOperation({ summary: "Soft-delete (deactivate) a user" })
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.remove(id, user)
  }
}
