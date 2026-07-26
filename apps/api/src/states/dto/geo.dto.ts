import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger"
import { UlbType } from "@workspace/database"
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator"

export class CreateStateDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string
}

export class UpdateStateDto extends PartialType(CreateStateDto) {}

export class CreateDistrictDto {
  @ApiProperty()
  @IsString()
  stateId!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string

  @ApiProperty({ example: "BAG", description: "Exactly 3 uppercase A–Z letters" })
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: "District code must be exactly 3 letters (A–Z)" })
  code!: string
}

export class UpdateDistrictDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stateId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string

  @ApiPropertyOptional({ example: "BAG" })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: "District code must be exactly 3 letters (A–Z)" })
  code?: string
}

export class CreateUlbDto {
  @ApiProperty()
  @IsString()
  districtId!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string

  @ApiProperty({ enum: UlbType })
  @IsEnum(UlbType)
  type!: UlbType
}

export class UpdateUlbDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  districtId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code?: string

  @ApiPropertyOptional({ enum: UlbType })
  @IsOptional()
  @IsEnum(UlbType)
  type?: UlbType
}

export class CreateWardDto {
  @ApiProperty()
  @IsString()
  ulbId!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  wardNumber!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  wardName!: string
}

export class UpdateWardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ulbId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  wardNumber?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  wardName?: string
}
