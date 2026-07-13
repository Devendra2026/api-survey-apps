import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiPropertyOptional, ApiTags } from "@nestjs/swagger"
import { PhotoType } from "@workspace/database"
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator"
import { memoryStorage } from "multer"
import { Type } from "class-transformer"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { CreatePhotoDto, UpdatePhotoDto } from "../floors/dto/related.dto.js"
import { PhotosService } from "./photos.service.js"

class PhotoQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  surveyId?: string
}

class UploadPhotoMetaDto {
  @IsString()
  surveyId!: string

  @IsEnum(PhotoType)
  photoType!: PhotoType

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  width?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  height?: number

  @IsOptional()
  @IsDateString()
  capturedAt?: string
}

@ApiTags("photos")
@ApiBearerAuth()
@Controller("photos")
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findAll(@Query() query: PhotoQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.photosService.findAll(query, user, query.surveyId)
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.SURVEY_VIEW)
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.photosService.findById(id, user)
  }

  @Post()
  @RequirePermission(PERMISSIONS.PHOTO_CREATE)
  @ApiOperation({ summary: "Create photo metadata with an existing URL (legacy)" })
  create(@Body() dto: CreatePhotoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.photosService.create(dto, user)
  }

  @Post("upload")
  @RequirePermission(PERMISSIONS.PHOTO_CREATE)
  @ApiOperation({ summary: "Upload image to S3 and store photo metadata" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "surveyId", "photoType"],
      properties: {
        file: { type: "string", format: "binary" },
        surveyId: { type: "string" },
        photoType: { type: "string", enum: Object.values(PhotoType) },
        width: { type: "number" },
        height: { type: "number" },
        capturedAt: { type: "string", format: "date-time" },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    })
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadPhotoMetaDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.photosService.upload(body.surveyId, body.photoType, file, user, {
      width: body.width,
      height: body.height,
      capturedAt: body.capturedAt,
    })
  }

  @Put(":id/replace")
  @RequirePermission(PERMISSIONS.PHOTO_UPDATE)
  @ApiOperation({ summary: "Replace photo image in S3" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    })
  )
  replace(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { photoType?: PhotoType; width?: number; height?: number; capturedAt?: string },
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.photosService.replace(id, file, user, body)
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.PHOTO_UPDATE)
  update(@Param("id") id: string, @Body() dto: UpdatePhotoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.photosService.update(id, dto, user)
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.PHOTO_DELETE)
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.photosService.delete(id, user)
  }
}
