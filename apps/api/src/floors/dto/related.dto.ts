import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger"
import { ConstructionType, FloorPosition, PhotoType, usageFactor, usageType } from "@workspace/database"
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

  @ApiPropertyOptional({ enum: usageFactor })
  @IsOptional()
  @IsEnum(usageFactor)
  usageFactor?: usageFactor

  @ApiPropertyOptional({ enum: usageType })
  @IsOptional()
  @IsEnum(usageType)
  usageType?: usageType

  @ApiPropertyOptional({ enum: ConstructionType })
  @IsOptional()
  @IsEnum(ConstructionType)
  constructionType?: ConstructionType

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
