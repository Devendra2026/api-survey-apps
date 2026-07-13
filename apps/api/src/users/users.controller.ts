import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { AssignTenantRoleDto, CreateUserDto, SyncUserDto, UpdateUserDto } from "./dto/user.dto.js"
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

  @Get()
  @RequirePermission(PERMISSIONS.USER_VIEW)
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query)
  }

  @Post("tenant-roles/assign")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  assignTenantRole(@CurrentUser() user: AuthenticatedUser, @Body() dto: AssignTenantRoleDto) {
    return this.usersService.assignTenantRole(dto, user)
  }

  @Delete("tenant-roles/:id")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  deactivateTenantRole(@Param("id") id: string) {
    return this.usersService.deactivateTenantRole(id)
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.USER_VIEW)
  findOne(@Param("id") id: string) {
    return this.usersService.findById(id)
  }

  @Post()
  @RequirePermission(PERMISSIONS.USER_CREATE)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.USER_UPDATE)
  update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto)
  }
}
