import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { CreateSavedViewDto, SavedViewQueryDto, UpdateSavedViewDto } from "./dto/saved-view.dto.js"
import { SavedViewsService } from "./saved-views.service.js"

@ApiTags("saved-views")
@ApiBearerAuth()
@Controller("saved-views")
export class SavedViewsController {
  constructor(private readonly savedViewsService: SavedViewsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  @ApiOperation({ summary: "List saved views for the current user" })
  list(@Query() query: SavedViewQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.savedViewsService.list(query, user)
  }

  @Post()
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  @ApiOperation({ summary: "Create a saved view (scoped to current user)" })
  create(@Body() dto: CreateSavedViewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.savedViewsService.create(dto, user)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  update(@Param("id") id: string, @Body() dto: UpdateSavedViewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.savedViewsService.update(id, dto, user)
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.savedViewsService.remove(id, user)
  }
}
