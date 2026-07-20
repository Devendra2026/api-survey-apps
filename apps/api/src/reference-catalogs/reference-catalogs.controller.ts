import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import {
  BulkStatusDto,
  CloneReferenceEntryDto,
  CreateReferenceEntryDto,
  UpdateReferenceEntryDto,
} from "./dto/reference-catalog.dto.js"
import { ReferenceCatalogsService } from "./reference-catalogs.service.js"

@ApiTags("configuration-reference")
@ApiBearerAuth()
@Controller("configuration")
export class ReferenceCatalogsController {
  constructor(private readonly referenceCatalogsService: ReferenceCatalogsService) {}

  @Get("categories")
  @RequirePermission(PERMISSIONS.SETTINGS_VIEW)
  listCategories() {
    return this.referenceCatalogsService.listCategories()
  }

  @Get("categories/:code/entries")
  @RequirePermission(PERMISSIONS.SETTINGS_VIEW)
  listEntries(
    @Param("code") code: string,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.referenceCatalogsService.listEntries(code, {
      search,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Post("entries")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  create(@Body() dto: CreateReferenceEntryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referenceCatalogsService.createEntry(dto, user.id)
  }

  @Patch("entries/:id")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  update(@Param("id") id: string, @Body() dto: UpdateReferenceEntryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referenceCatalogsService.updateEntry(id, dto, user.id)
  }

  @Post("entries/:id/clone")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  clone(@Param("id") id: string, @Body() dto: CloneReferenceEntryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referenceCatalogsService.cloneEntry(id, dto, user.id)
  }

  @Post("entries/bulk-status")
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  bulkStatus(@Body() dto: BulkStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referenceCatalogsService.bulkStatus(dto, user.id)
  }
}
