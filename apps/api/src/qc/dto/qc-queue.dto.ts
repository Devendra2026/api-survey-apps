import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsOptional, IsString } from "class-validator"

export class QcQueueFirstQueryDto {
  @ApiProperty({ description: "Active ward id" })
  @IsString()
  wardId!: string

  /** Required for All Wards (ULB-scoped) callers; TenantGuard matches ulbId, not wardId alone. */
  @ApiPropertyOptional({ description: "Active ULB id for tenant scope" })
  @IsOptional()
  @IsString()
  ulbId?: string
}

export class QcQueueNeighborsQueryDto {
  @ApiProperty({ description: "Active ward id" })
  @IsString()
  wardId!: string

  /** Prisma survey ids are CUIDs, not UUIDs. */
  @ApiProperty({ description: "Current survey id" })
  @IsString()
  surveyId!: string

  /** Required for All Wards (ULB-scoped) callers; TenantGuard matches ulbId, not wardId alone. */
  @ApiPropertyOptional({ description: "Active ULB id for tenant scope" })
  @IsOptional()
  @IsString()
  ulbId?: string
}

export class QcQueueByParcelQueryDto {
  @ApiProperty({ description: "Active ward id" })
  @IsString()
  wardId!: string

  @ApiProperty({ description: "Parcel number to jump to" })
  @IsString()
  parcelNumber!: string

  /** Required for All Wards (ULB-scoped) callers; TenantGuard matches ulbId, not wardId alone. */
  @ApiPropertyOptional({ description: "Active ULB id for tenant scope" })
  @IsOptional()
  @IsString()
  ulbId?: string
}

export class QcQueueParcelDto {
  @ApiProperty()
  id!: string

  @ApiPropertyOptional({ nullable: true })
  parcelNumber!: string | null
}

export class QcQueueNeighborsDto {
  @ApiPropertyOptional({ nullable: true })
  prevId!: string | null

  @ApiPropertyOptional({ nullable: true })
  nextId!: string | null

  @ApiPropertyOptional({ nullable: true })
  parcelNumber!: string | null
}
