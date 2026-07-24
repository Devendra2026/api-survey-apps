import { Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger"
import { Throttle } from "@nestjs/throttler"
import { memoryStorage } from "multer"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { GeoCatalogImportService } from "./geo-catalog-import.service.js"
import { ImportsService } from "./imports.service.js"

const ASYNC_IMPORT_MAX_BYTES = 100 * 1024 * 1024

@ApiTags("imports")
@ApiBearerAuth()
@Controller("imports")
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly geoCatalogImportService: GeoCatalogImportService
  ) {}

  @Post("surveys")
  @RequirePermission(PERMISSIONS.SURVEY_CREATE)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Import surveys from Convex Excel (.xlsx) or CSV (async by default)" })
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
      limits: { fileSize: ASYNC_IMPORT_MAX_BYTES },
    })
  )
  importSurveys(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
    @Query("sync") sync?: string
  ) {
    if (sync === "true") {
      return this.importsService.importSurveys(file, user, { enforceSyncCap: true })
    }
    return this.importsService.enqueueSurveyImport(file, user)
  }

  @Post("surveys/preview")
  @RequirePermission(PERMISSIONS.SURVEY_CREATE)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: "Preview/validate a Convex survey workbook without enqueueing an import job",
  })
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
      limits: { fileSize: ASYNC_IMPORT_MAX_BYTES },
    })
  )
  previewSurveys(@UploadedFile() file: Express.Multer.File) {
    return this.importsService.previewSurveyImport(file)
  }

  @Post("geo-catalog")
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: "Upsert State/District/ULB/Ward master data from GeoCatalog Excel/CSV (required before survey import)",
  })
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
      limits: { fileSize: 20 * 1024 * 1024 },
    })
  )
  importGeoCatalog(@UploadedFile() file: Express.Multer.File) {
    return this.geoCatalogImportService.importCatalog(file)
  }

  @Get("jobs")
  @RequirePermission(PERMISSIONS.SURVEY_CREATE)
  @ApiOperation({ summary: "List import jobs for the current user" })
  listJobs(@CurrentUser() user: AuthenticatedUser, @Query("take") take?: string) {
    const parsed = take ? Number.parseInt(take, 10) : 50
    return this.importsService.listJobs(user, Number.isFinite(parsed) ? parsed : 50)
  }

  @Get("jobs/:id")
  @RequirePermission(PERMISSIONS.SURVEY_CREATE)
  @ApiOperation({ summary: "Get an import job by id" })
  getJob(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.importsService.getJob(user, id)
  }

  @Post("jobs/:id/resume")
  @RequirePermission(PERMISSIONS.SURVEY_CREATE)
  @ApiOperation({ summary: "Resume a failed/interrupted import from its checkpoint" })
  resumeJob(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.importsService.resumeJob(user, id)
  }

  @Post("jobs/:id/retry-failed")
  @RequirePermission(PERMISSIONS.SURVEY_CREATE)
  @ApiOperation({ summary: "Retry only failed rows from a completed/failed import validation report" })
  retryFailed(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.importsService.retryFailedRows(user, id)
  }

  @Get("jobs/:id/error-report")
  @RequirePermission(PERMISSIONS.SURVEY_CREATE)
  @ApiOperation({ summary: "Get a signed URL for the import validation/error report" })
  errorReport(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.importsService.getErrorReport(user, id)
  }
}
