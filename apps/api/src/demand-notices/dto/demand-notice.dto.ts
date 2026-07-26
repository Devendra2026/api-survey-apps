import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsOptional, IsString } from "class-validator"
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto.js"

export class DemandNoticeListQueryDto extends PaginationQueryDto {
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

  @ApiPropertyOptional({ description: "ReferenceEntry id for ASSESSMENT_YEAR" })
  @IsOptional()
  @IsString()
  assessmentYearId?: string

  @ApiPropertyOptional({ description: "Survey AssessmentYear enum code e.g. AY_2025_2026" })
  @IsOptional()
  @IsString()
  assessmentYear?: string
}

export class DemandNoticePrintTokenDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  surveyId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wardId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assessmentYearId?: string
}
