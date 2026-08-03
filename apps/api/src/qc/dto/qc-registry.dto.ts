import { ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"

export const QC_REGISTRY_SEARCH_FIELDS = ["all", "owner", "parcel", "propertyId"] as const
export type QcRegistrySearchField = (typeof QC_REGISTRY_SEARCH_FIELDS)[number]

export class QcRegistryQueryDto {
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
    enum: QC_REGISTRY_SEARCH_FIELDS,
    default: "all",
  })
  @IsOptional()
  @IsIn(QC_REGISTRY_SEARCH_FIELDS)
  searchField?: QcRegistrySearchField

  @ApiPropertyOptional({
    description: "Pipeline tab filter",
    enum: ["pendingApproved", "pendingQc", "approved", "returned", "parcelShared", "all"],
    default: "pendingApproved",
  })
  @IsOptional()
  @IsString()
  status?: string

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
  sortBy?: string

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsString()
  sortOrder?: "asc" | "desc"
}
