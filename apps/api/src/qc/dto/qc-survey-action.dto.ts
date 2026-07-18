import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import {
  AssessmentYear,
  ConstructionType,
  FloorPosition,
  OwnershipType,
  PropertyType,
  PropertyUse,
  RoadType,
  SanitationType,
  Situation,
  SourceOfWater,
  TaxRateZone,
  UsageFactor,
  UsageType,
  WaterConnection,
} from "@workspace/database"
import { Type } from "class-transformer"
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
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

export class QcCoOwnerInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string

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

export class QcSurveyCorrectionDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  assignedToId?: string | null

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fatherHusbandName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sectorNo?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unitSubNo?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  parcelNumber?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  propertyIdOld?: string

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  constructedYear?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSlum?: boolean

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
  plinthAreaSqFt?: number

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  electricityConsumerNo?: string

  @ApiPropertyOptional({ description: "WGS84 latitude (-90..90)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number

  @ApiPropertyOptional({ description: "WGS84 longitude (-180..180)" })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number

  @ApiPropertyOptional({ type: [QcFloorInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QcFloorInputDto)
  floors?: QcFloorInputDto[]

  @ApiPropertyOptional({ type: [QcCoOwnerInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QcCoOwnerInputDto)
  coOwners?: QcCoOwnerInputDto[]
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
