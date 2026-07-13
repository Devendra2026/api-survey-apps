import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from "@nestjs/swagger"
import { IsOptional, IsString } from "class-validator"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { CreateCoOwnerDto, UpdateCoOwnerDto } from "../floors/dto/related.dto.js"
import { CoOwnersService } from "./co-owners.service.js"

class CoOwnerQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  surveyId?: string
}

@ApiTags("co-owners")
@ApiBearerAuth()
@Controller("coowners")
export class CoOwnersController {
  constructor(private readonly coOwnersService: CoOwnersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findAll(@Query() query: CoOwnerQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.coOwnersService.findAll(query, user, query.surveyId)
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coOwnersService.findById(id, user)
  }

  @Post()
  @RequirePermission(PERMISSIONS.SURVEY_UPDATE)
  create(@Body() dto: CreateCoOwnerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.coOwnersService.create(dto, user)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.SURVEY_UPDATE)
  update(@Param("id") id: string, @Body() dto: UpdateCoOwnerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.coOwnersService.update(id, dto, user)
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.SURVEY_UPDATE)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coOwnersService.delete(id, user)
  }
}
