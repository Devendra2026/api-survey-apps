import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from "class-validator"

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string
}

export class AssignPermissionDto {
  @ApiProperty()
  @IsString()
  roleId!: string

  @ApiProperty()
  @IsString()
  permissionId!: string
}

export class SetRolePermissionsDto {
  @ApiProperty({ type: [String], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1, { message: "At least one permission is required" })
  @IsString({ each: true })
  permissionIds!: string[]
}

export class CloneRoleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string
}

export class CreatePermissionDto {
  @ApiProperty({ example: "survey:create" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string
}

export class UpdatePermissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string
}
