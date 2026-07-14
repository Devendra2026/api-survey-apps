import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsOptional, IsString } from "class-validator"

export class CommandCenterFiltersDto {
  @ApiPropertyOptional({ description: "District ID" })
  @IsOptional()
  @IsString()
  districtId?: string

  /** Alias for clients using `district=` */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string

  @ApiPropertyOptional({ description: "ULB ID" })
  @IsOptional()
  @IsString()
  ulbId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ulb?: string

  @ApiPropertyOptional({ description: "Ward ID" })
  @IsOptional()
  @IsString()
  wardId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ward?: string

  @ApiPropertyOptional({ description: "Survey status enum or 'any'" })
  @IsOptional()
  @IsString()
  surveyStatus?: string

  @ApiPropertyOptional({ description: "QC status enum or 'any'" })
  @IsOptional()
  @IsString()
  qcStatus?: string

  @ApiPropertyOptional({ description: "ISO date YYYY-MM-DD" })
  @IsOptional()
  @IsString()
  dateFrom?: string

  @ApiPropertyOptional({ description: "ISO date YYYY-MM-DD" })
  @IsOptional()
  @IsString()
  dateTo?: string

  @ApiPropertyOptional({ description: "Month filter YYYY-MM" })
  @IsOptional()
  @IsString()
  month?: string
}
