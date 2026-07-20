import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator"

export class CreateReferenceEntryDto {
  @IsString()
  categoryCode!: string

  @IsString()
  @MinLength(1)
  code!: string

  @IsString()
  @MinLength(1)
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  value?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}

export class UpdateReferenceEntryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  value?: string

  @IsOptional()
  @IsIn(["ACTIVE", "DISABLED", "ARCHIVED"])
  status?: "ACTIVE" | "DISABLED" | "ARCHIVED"

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number

  @IsOptional()
  @IsString()
  reason?: string
}

export class BulkStatusDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[]

  @IsIn(["ACTIVE", "DISABLED", "ARCHIVED"])
  status!: "ACTIVE" | "DISABLED" | "ARCHIVED"

  @IsOptional()
  @IsString()
  reason?: string
}

export class CloneReferenceEntryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string
}
