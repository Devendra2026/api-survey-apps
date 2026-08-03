import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator"

export const SURVEY_REGISTRY_SEARCH_FIELDS = ["all", "owner", "parcel", "propertyId"] as const
export type SurveyRegistrySearchField = (typeof SURVEY_REGISTRY_SEARCH_FIELDS)[number]

export class SurveyRegistryQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50

  @ApiPropertyOptional({ description: "Search text (owner, parcel, and/or property ID depending on searchField)" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @ApiPropertyOptional({
    description: "Which field(s) search applies to",
    enum: SURVEY_REGISTRY_SEARCH_FIELDS,
    default: "all",
  })
  @IsOptional()
  @IsIn(SURVEY_REGISTRY_SEARCH_FIELDS)
  searchField?: SurveyRegistrySearchField

  @ApiPropertyOptional({
    description: "Tab filter",
    enum: ["all", "draft", "submitted", "qcPending", "qcApproved", "rejected"],
  })
  @IsOptional()
  @IsString()
  tab?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  districtId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ulbId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wardId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  surveyorId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc"
}

export class ReassignDraftsDto {
  @ApiProperty({ description: "Source surveyor user id (omit or empty for orphaned drafts)" })
  @IsOptional()
  @IsString()
  fromSurveyorId?: string

  @ApiProperty({ description: "Target surveyor user id" })
  @IsString()
  @MinLength(1)
  toSurveyorId!: string

  @ApiPropertyOptional({ description: "Optional ward scope id" })
  @IsOptional()
  @IsString()
  scopeId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  districtId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ulbId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wardId?: string

  /** Alias accepted by some clients */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromSurveyor?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toSurveyor?: string
}
