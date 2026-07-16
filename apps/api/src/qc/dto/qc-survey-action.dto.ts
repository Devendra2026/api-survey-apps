import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  AssessmentYear,
  ConstructionType,
  FloorPosition,
  OwnershipType,
  PropertyType,
  PropertyUse,
  RoadType,
  Situation,
  TaxRateZone,
  UsageFactor,
  UsageType,
} from "@workspace/database"
import { Type } from "class-transformer"
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator"

export class QcFloorInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string

  @ApiProperty({ enum: FloorPosition })
  @IsEnum(FloorPosition)
  floorPosition!: FloorPosition

  @ApiPropertyOptional({ enum: UsageType })
  @IsOptional()
  @IsEnum(UsageType)
  usageType?: UsageType

  @ApiPropertyOptional({ enum: UsageFactor })
  @IsOptional()
  @IsEnum(UsageFactor)
  usageFactor?: UsageFactor

  @ApiPropertyOptional({ enum: ConstructionType })
  @IsOptional()
  @IsEnum(ConstructionType)
  constructionType?: ConstructionType

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  areaSqFt?: number
}

export class QcSurveyCorrectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  respondentName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobileNumber?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  alternateMobile?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  relationshipWithOwner?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  familySize?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  houseDoorNo?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  colony?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  locality?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(12)
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

  @ApiPropertyOptional({ type: [QcFloorInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QcFloorInputDto)
  floors?: QcFloorInputDto[]
}

export class QcSurveyActionDto {
  @ApiProperty({
    enum: ["reopen", "approve", "delete", "correct", "reject"],
    description: "QC action to perform on the survey",
  })
  @IsIn(["reopen", "approve", "delete", "correct", "reject"])
  action!: "reopen" | "approve" | "delete" | "correct" | "reject"

  @ApiPropertyOptional({ description: "Required when action is reject" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  qcRemarks?: string

  @ApiPropertyOptional({ type: QcSurveyCorrectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QcSurveyCorrectionDto)
  patch?: QcSurveyCorrectionDto
}
