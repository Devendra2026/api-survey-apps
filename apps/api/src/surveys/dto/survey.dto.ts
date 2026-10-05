import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger"
import {
  AssessmentYear,
  GpsSource,
  OwnershipType,
  PropertyType,
  PropertyUse,
  QcStatus,
  RoadType,
  SanitationType,
  Situation,
  SourceOfWater,
  SurveyStatus,
  TaxRateZone,
  WaterConnection,
} from "@workspace/database"
import {
  QC_CORRECTION_FIELD_MAX,
  QC_CORRECTION_MAX_ITEMS,
  QC_CORRECTION_NOTE_MAX,
  QC_CORRECTION_REASON_MAX,
  QC_CORRECTION_SECTIONS,
  type QcCorrectionSection,
} from "@workspace/validation"
import { Transform, Type } from "class-transformer"
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsBooleanString,
  IsDateString,
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
  ValidateBy,
  ValidateNested,
} from "class-validator"
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto.js"

/** Earliest constructed year accepted on a field survey. */
const MIN_CONSTRUCTED_YEAR = 1800

function currentCalendarYear(): number {
  return new Date().getFullYear()
}

function isConstructedYearInRange(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_CONSTRUCTED_YEAR &&
    value <= currentCalendarYear()
  )
}

function nullableConstructedYear({ value }: { value: unknown }): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  return parsed
}

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

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sectorNo?: string | null

  @ApiPropertyOptional({ nullable: true, minimum: MIN_CONSTRUCTED_YEAR })
  @IsOptional()
  @Transform(nullableConstructedYear)
  @ValidateBy({
    name: "constructedYearRange",
    validator: {
      validate: isConstructedYearInRange,
      defaultMessage: () =>
        `constructedYear must be an integer from ${MIN_CONSTRUCTED_YEAR} through ${currentCalendarYear()}`,
    },
  })
  constructedYear?: number | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSlum?: boolean

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

  @ApiProperty({ enum: AssessmentYear })
  @IsEnum(AssessmentYear)
  assessmentYear!: AssessmentYear

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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  gpsAccuracyMeters?: number

  @ApiPropertyOptional({ enum: GpsSource })
  @IsOptional()
  @IsEnum(GpsSource)
  gpsSource?: GpsSource

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  capturedAt?: string
}

export class UpdateSurveyDto extends PartialType(CreateSurveyDto) {}

export class QcCorrectionItemDto {
  @ApiProperty({ enum: QC_CORRECTION_SECTIONS, description: "Survey section (mobile wizard step) to correct" })
  @IsIn(QC_CORRECTION_SECTIONS)
  section!: QcCorrectionSection

  @ApiPropertyOptional({ maxLength: QC_CORRECTION_FIELD_MAX, description: "Field within the section" })
  @IsOptional()
  @IsString()
  @MaxLength(QC_CORRECTION_FIELD_MAX)
  field?: string

  @ApiProperty({ maxLength: QC_CORRECTION_REASON_MAX })
  @IsString()
  @MinLength(1)
  @MaxLength(QC_CORRECTION_REASON_MAX)
  reason!: string

  @ApiPropertyOptional({ maxLength: QC_CORRECTION_NOTE_MAX, description: "Extra instructions for the surveyor" })
  @IsOptional()
  @IsString()
  @MaxLength(QC_CORRECTION_NOTE_MAX)
  note?: string
}

export class RejectSurveyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  qcRemarks!: string

  @ApiPropertyOptional({ type: [QcCorrectionItemDto], maxItems: QC_CORRECTION_MAX_ITEMS })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(QC_CORRECTION_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => QcCorrectionItemDto)
  corrections?: QcCorrectionItemDto[]
}

export class AssignSurveyDto {
  @ApiProperty({ description: "User ID of the surveyor to assign" })
  @IsString()
  assigneeId!: string
}

export class SurveyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Use cursor pagination instead of page/limit offsets" })
  @IsOptional()
  @IsBooleanString()
  cursorPagination?: string

  @ApiPropertyOptional({ description: "Opaque cursor returned by a previous cursor-paginated survey response" })
  @IsOptional()
  @IsString()
  cursor?: string

  @ApiPropertyOptional({ enum: SurveyStatus })
  @IsOptional()
  @IsEnum(SurveyStatus)
  surveyStatus?: SurveyStatus

  @ApiPropertyOptional({ enum: QcStatus })
  @IsOptional()
  @IsEnum(QcStatus)
  qcStatus?: QcStatus

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

  @ApiPropertyOptional({ description: "Filter by assigned surveyor user id" })
  @IsOptional()
  @IsString()
  surveyorId?: string

  @ApiPropertyOptional({ description: "Inclusive createdAt lower bound (ISO date)" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @ApiPropertyOptional({ description: "Inclusive createdAt upper bound (ISO date)" })
  @IsOptional()
  @IsDateString()
  dateTo?: string

  @ApiPropertyOptional({ description: "Exact/partial mobile number search" })
  @IsOptional()
  @IsString()
  mobile?: string
}

export class BulkSurveyIdsDto {
  @ApiProperty({ type: [String], minItems: 1, maxItems: 200 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  ids!: string[]
}

export class BulkRejectSurveysDto extends BulkSurveyIdsDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  qcRemarks!: string
}

export class BulkExportSurveysDto {
  @ApiProperty({ type: [String], minItems: 1, maxItems: 5000 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  selectedIds!: string[]

  @ApiPropertyOptional({
    enum: ["surveys", "convex_full", "survey_data", "nagar_panchayat", "qc_final"],
    default: "survey_data",
  })
  @IsOptional()
  @IsString()
  reportType?: "surveys" | "convex_full" | "survey_data" | "nagar_panchayat" | "qc_final"
}

export class FieldMetricsQueryDto {
  @ApiPropertyOptional({
    enum: ["self", "team"],
    default: "self",
    description: "self = surveys assigned to the caller; team = everyone in the caller's tenant scope",
  })
  @IsOptional()
  @IsIn(["self", "team"])
  scope?: "self" | "team"

  @ApiPropertyOptional({ description: "Caller's local start of day (ISO). Falls back to UTC midnight." })
  @IsOptional()
  @IsDateString()
  todayStart?: string
}

export class WardStatsQueryDto {
  @ApiPropertyOptional({ default: 8, minimum: 1, maximum: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit?: number = 8

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  districtId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ulbId?: string
}
