import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator"

export class CreateSavedViewDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional({ default: "surveys" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entity?: string

  @ApiProperty({ description: "Serialized filter state for the registry" })
  @IsObject()
  filters!: Record<string, unknown>

  @ApiPropertyOptional({ description: "Column visibility / order state" })
  @IsOptional()
  @IsObject()
  columns?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc"

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean
}

export class UpdateSavedViewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  columns?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc"

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean
}

export class SavedViewQueryDto {
  @ApiPropertyOptional({ default: "surveys" })
  @IsOptional()
  @IsString()
  entity?: string
}
