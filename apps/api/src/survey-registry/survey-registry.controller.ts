import { Body, Controller, Get, Post, Query, UploadedFile, UseInterceptors } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"
import { memoryStorage } from "multer"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { ReassignDraftsDto, SurveyRegistryQueryDto } from "./dto/survey-registry.dto.js"
import { SurveyRegistryService } from "./survey-registry.service.js"

@ApiTags("survey-registry")
@ApiBearerAuth()
@Controller("survey-registry")
export class SurveyRegistryController {
  constructor(private readonly surveyRegistryService: SurveyRegistryService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  @ApiOperation({ summary: "Survey registry list with status tab counts" })
  getRegistryRecords(@Query() query: SurveyRegistryQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveyRegistryService.list(query, user)
  }

  @Get("draft-sources")
  @RequirePermission(PERMISSIONS.SURVEY_ASSIGN)
  @ApiOperation({ summary: "Surveyors with draft surveys in scope (for reassignment)" })
  listDraftSources(
    @Query() query: SurveyRegistryQueryDto,
    @Query("orphaned") orphaned: string | undefined,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.surveyRegistryService.listDraftSources({ ...query, orphaned: orphaned === "true" }, user)
  }

  @Post("import")
  @RequirePermission(PERMISSIONS.SURVEY_CREATE)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Import survey registry Excel file" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    })
  )
  importExcelData(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    return this.surveyRegistryService.importExcel(file, user)
  }

  @Post("reassign")
  @RequirePermission(PERMISSIONS.SURVEY_ASSIGN)
  @ApiOperation({ summary: "Bulk reassign draft surveys between surveyors" })
  reassignDraftSurveys(@Body() dto: ReassignDraftsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.surveyRegistryService.reassignDrafts(dto, user)
  }
}
