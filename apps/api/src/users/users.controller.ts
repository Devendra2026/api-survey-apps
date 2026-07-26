import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"
import { memoryStorage } from "multer"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { AssignTenantRoleDto, CreateUserDto, ListUsersQueryDto, SyncUserDto, UpdateUserDto } from "./dto/user.dto.js"
import { UsersService } from "./users.service.js"

const USER_IMPORT_MAX_BYTES = 10 * 1024 * 1024

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

  @Post("sync-from-clerk")
  @RequirePermission(PERMISSIONS.USER_CREATE)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: "Paginate Clerk users.list and upsert into the app DB (PENDING_APPROVAL when no role)",
  })
  syncFromClerk() {
    return this.usersService.syncFromClerk()
  }

  @Get("import/template")
  @RequirePermission(PERMISSIONS.USER_VIEW)
  @ApiOperation({ summary: "Download CSV template for user import" })
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="users-import-template.csv"')
  importTemplate(): StreamableFile {
    const csv = this.usersService.getImportTemplateCsv()
    return new StreamableFile(Buffer.from(csv, "utf8"))
  }

  @Post("import")
  @RequirePermission(PERMISSIONS.USER_CREATE)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Import users from CSV/XLSX into the app DB (optional ?dryRun=true)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", format: "binary" },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: USER_IMPORT_MAX_BYTES },
    })
  )
  importUsers(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Query("dryRun") dryRun?: string
  ) {
    return this.usersService.importUsers(file, user, { dryRun: dryRun === "true" })
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
  @ApiOperation({ summary: "Permanently delete a user" })
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.remove(id, user)
  }
}
