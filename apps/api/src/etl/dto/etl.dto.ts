import { Type } from "class-transformer"
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator"

export class StartEtlDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  batchSize?: number

  @IsOptional()
  @IsBoolean()
  force?: boolean
}

export class RetryFailedDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxRetries?: number
}

export class ListEtlJobsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @IsOptional()
  @IsString()
  cursor?: string
}

export class AlignWardsDto {
  /** When false, report only. When true, write changes. */
  @IsBoolean()
  apply!: boolean

  /** District to scope the ward align run to. */
  @IsNotEmpty()
  @IsString()
  districtId!: string

  @IsOptional()
  @IsString()
  ulbCode?: string
}

export class CleanupEmptyStatesDto {
  /** When false, report only. When true, delete empty duplicate UP shells. */
  @IsBoolean()
  apply!: boolean
}

export class RefreshPendingDto {
  /** District to scope the refresh-pending run to. */
  @IsNotEmpty()
  @IsString()
  districtId!: string

  /** When false, report only the count of PENDING surveys that would be refreshed. */
  @IsBoolean()
  apply!: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  batchSize?: number
}

export class ReconcileDto {
  /** District to scope the read-only reconcile report to. */
  @IsNotEmpty()
  @IsString()
  districtId!: string
}
