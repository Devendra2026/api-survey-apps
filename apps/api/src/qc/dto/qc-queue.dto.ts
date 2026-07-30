import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { IsString, IsUUID } from "class-validator"

export class QcQueueFirstQueryDto {
  @ApiProperty({ description: "Active ward id" })
  @IsString()
  wardId!: string
}

export class QcQueueNeighborsQueryDto {
  @ApiProperty({ description: "Active ward id" })
  @IsString()
  wardId!: string

  @ApiProperty({ description: "Current survey id" })
  @IsUUID()
  surveyId!: string
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
