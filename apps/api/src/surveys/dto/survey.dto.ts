import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger"
import {
  AssessmentYear,
  GPSCordinates,
  OwnershipType,
  PropertyType,
  PropertyUse,
  RoadType,
  SanitationType,
  Situation,
  SourceOfWater,
  SurveyStatus,
  TaxRateZone,
  WaterConnection,
} from "@workspace/database"
import { Type } from "class-transformer"
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator"
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto.js"

export class CreateSurveyDto {
  @ApiProperty()
  @IsString()
  stateId!: string

  @ApiProperty()
  @IsString()
  districtId!: string

  @ApiProperty()
  @IsString()
  ulbId!: string

  @ApiProperty()
  @IsString()
  wardId!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  propertyId!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  localId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  propertyIdOld?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parcelNumber?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitSubNo?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wardNumber?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ulbCode?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  districtName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  respondentName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relationshipWithOwner?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobileNumber?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alternateMobile?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  familySize?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  houseDoorNo?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locality?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  colony?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pinCode?: string

  @ApiPropertyOptional({ enum: OwnershipType })
  @IsOptional()
  @IsEnum(OwnershipType)
  ownershipType?: OwnershipType

  @ApiPropertyOptional({ enum: PropertyUse })
  @IsOptional()
  @IsEnum(PropertyUse)
  propertyUse?: PropertyUse

  @ApiPropertyOptional({ enum: PropertyType })
  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType

  @ApiPropertyOptional({ enum: Situation })
  @IsOptional()
  @IsEnum(Situation)
  situation?: Situation

  @ApiPropertyOptional({ enum: RoadType })
  @IsOptional()
  @IsEnum(RoadType)
  roadType?: RoadType

  @ApiPropertyOptional({ enum: TaxRateZone })
  @IsOptional()
  @IsEnum(TaxRateZone)
  taxRateZone?: TaxRateZone

  @ApiPropertyOptional({ enum: AssessmentYear })
  @IsOptional()
  @IsEnum(AssessmentYear)
  assessmentYear?: AssessmentYear

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  plotAreaSqFt?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  plotAreaSqMeter?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  plinthAreaSqFt?: number

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  plinthAreaSqMeter?: number

  @ApiPropertyOptional({ enum: WaterConnection })
  @IsOptional()
  @IsEnum(WaterConnection)
  waterConnection?: WaterConnection

  @ApiPropertyOptional({ enum: SourceOfWater })
  @IsOptional()
  @IsEnum(SourceOfWater)
  sourceOfWater?: SourceOfWater

  @ApiPropertyOptional({ enum: SanitationType })
  @IsOptional()
  @IsEnum(SanitationType)
  sanitationType?: SanitationType

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  solidWasteCollection?: boolean

  @ApiPropertyOptional({ enum: GPSCordinates })
  @IsOptional()
  @IsEnum(GPSCordinates)
  gpsCoordinates?: GPSCordinates

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  capturedAt?: string
}

export class UpdateSurveyDto extends PartialType(CreateSurveyDto) {}

export class RejectSurveyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  qcRemarks!: string
}

export class SurveyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SurveyStatus })
  @IsOptional()
  @IsEnum(SurveyStatus)
  surveyStatus?: SurveyStatus

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stateId?: string

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
}
