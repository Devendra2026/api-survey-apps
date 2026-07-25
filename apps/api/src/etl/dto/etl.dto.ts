import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator"
import { Type } from "class-transformer"

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
