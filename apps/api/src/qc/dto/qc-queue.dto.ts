import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsString } from "class-validator"

export class QcQueueFirstQueryDto {
  @ApiProperty({ description: "Active ward id" })
  @IsString()
  wardId!: string
}

export class QcQueueNeighborsQueryDto {
  @ApiProperty({ description: "Active ward id" })
  @IsString()
  wardId!: string

  /** Prisma survey ids are CUIDs, not UUIDs. */
  @ApiProperty({ description: "Current survey id" })
  @IsString()
  surveyId!: string
}

export class QcQueueByParcelQueryDto {
  @ApiProperty({ description: "Active ward id" })
  @IsString()
  wardId!: string

  @ApiProperty({ description: "Parcel number to jump to" })
  @IsString()
  parcelNumber!: string
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
