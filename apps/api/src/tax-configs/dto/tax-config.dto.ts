import { Type } from "class-transformer"
import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateIf, ValidateNested } from "class-validator"

export class UpdateTaxConfigParamsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  propertyTaxPct?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  waterTaxPct?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  drainageTaxPct?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  penaltyPct?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  assessablePct?: number

  @IsOptional()
  @IsString()
  reason?: string
}

export class UpsertTaxCellDto {
  @IsString()
  roadWidthEntryId!: string

  @IsString()
  constructionEntryId!: string

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  annualRatePerSqFt!: number
}

export class UpsertTaxCellsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertTaxCellDto)
  cells!: UpsertTaxCellDto[]
}

export class TaxPreviewDto {
  @IsString()
  wardId!: string

  @IsString()
  assessmentYearId!: string

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  areaSqFt!: number

  @IsString()
  roadWidthEntryId!: string

  @IsString()
  constructionEntryId!: string
}

export class PublishTaxConfigDto {
  @IsOptional()
  @IsString()
  reason?: string

  @IsOptional()
  @IsString()
  effectiveFrom?: string
}

export class RollbackTaxConfigDto {
  @IsString()
  versionId!: string

  @IsOptional()
  @IsString()
  reason?: string
}

export class BulkApplyTaxConfigDto {
  @IsString()
  ulbId!: string

  @IsString()
  assessmentYearId!: string

  @IsIn(["copy", "zero"])
  mode!: "copy" | "zero"

  /** Required for mode=copy — ward whose rates are already saved and should be skipped. */
  @ValidateIf((o: BulkApplyTaxConfigDto) => o.mode === "copy")
  @IsString()
  sourceWardId?: string

  /** Required for mode=copy — cell rates to apply to every other ward in the ULB. */
  @ValidateIf((o: BulkApplyTaxConfigDto) => o.mode === "copy")
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertTaxCellDto)
  cells?: UpsertTaxCellDto[]
}
