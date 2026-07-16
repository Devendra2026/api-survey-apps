import { ApiPropertyOptional } from "@nestjs/swagger"
import { Type } from "class-transformer"
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator"

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

  @ApiPropertyOptional({ description: "Search property ID, owner, parcel, ward, or surveyor" })
  @IsOptional()
  @IsString()
  search?: string

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
