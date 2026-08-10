import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger"
import {
  ConstructionType,
  FloorPosition,
  PhotoType,
  StorageProvider,
  UsageFactor,
  UsageType,
} from "@workspace/database"
import { Type } from "class-transformer"
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from "class-validator"

export class CreateFloorDto {
  @ApiProperty()
  @IsString()
  surveyId!: string

  @ApiProperty({ enum: FloorPosition })
  @IsEnum(FloorPosition)
  floorPosition!: FloorPosition

  @ApiProperty({ enum: UsageFactor })
  @IsEnum(UsageFactor)
  usageFactor!: UsageFactor

  @ApiPropertyOptional({ enum: UsageType })
  @IsOptional()
  @IsEnum(UsageType)
  usageType?: UsageType

  @ApiProperty({ enum: ConstructionType })
  @IsEnum(ConstructionType)
  constructionType!: ConstructionType

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occupancy?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaSqFt?: number
}

export class UpdateFloorDto extends PartialType(CreateFloorDto) {}

export class CreatePhotoDto {
  @ApiProperty()
  @IsString()
  surveyId!: string

  @ApiProperty({ enum: PhotoType })
  @IsEnum(PhotoType)
  photoType!: PhotoType

  @ApiProperty()
  @IsString()
  @IsUrl({ require_tld: false })
  url!: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  width?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  height?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sizeKB?: number

  @ApiPropertyOptional({ enum: StorageProvider })
  @IsOptional()
  @IsEnum(StorageProvider)
  storageProvider?: StorageProvider

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bucket?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objectKey?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checksum?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  etag?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  capturedAt?: string
}

export class UpdatePhotoDto {
  @ApiPropertyOptional({ enum: PhotoType })
  @IsOptional()
  @IsEnum(PhotoType)
  photoType?: PhotoType

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  url?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  width?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  height?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sizeKB?: number

  @ApiPropertyOptional({ enum: StorageProvider })
  @IsOptional()
  @IsEnum(StorageProvider)
  storageProvider?: StorageProvider

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bucket?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objectKey?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checksum?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  etag?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  capturedAt?: string
}

export class CreateCoOwnerDto {
  @ApiProperty()
  @IsString()
  surveyId!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fatherOrHusbandName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  mobile?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  alternateMobile?: string
}

export class UpdateCoOwnerDto extends PartialType(CreateCoOwnerDto) {}
