import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { Transform, Type, type TransformFnParams } from "class-transformer"
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator"

/** Empty string → null for nullable phone fields; other values narrowed from unknown. */
function emptyStringToNull({ value }: TransformFnParams): string | null | undefined {
  const raw: unknown = value
  if (raw === "") return null
  if (raw === null || raw === undefined) return raw
  if (typeof raw === "string") return raw
  return undefined
}

/**
 * Coerce query-string / JSON booleans for optional filters.
 * Unrecognized values return a string so `@IsBoolean()` still rejects them.
 */
function toOptionalBoolean({ value }: TransformFnParams): boolean | string | undefined {
  const raw: unknown = value
  if (raw === undefined || raw === null || raw === "") return undefined
  if (raw === true || raw === "true" || raw === "1") return true
  if (raw === false || raw === "false" || raw === "0") return false
  if (typeof raw === "string") return raw
  return "invalid"
}

export class SyncUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName?: string

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyStringToNull)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(32)
  phone?: string | null

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

export class AssignTenantRoleDto {
  @ApiProperty()
  @IsString()
  userId!: string

  @ApiProperty()
  @IsString()
  roleId!: string

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
}

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  clerkUserId!: string

  @ApiProperty()
  @IsEmail()
  email!: string

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string
}

const ROLE_FILTER_NAMES = ["PENDING_APPROVAL", "SURVEYOR", "FIELD_SUPERVISOR", "QC_SUPERVISOR", "ADMIN"] as const

export class ListUsersQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20

  @ApiPropertyOptional({ description: "Field to sort by" })
  @IsOptional()
  @IsString()
  sortBy?: string = "createdAt"

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsString()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "desc"

  @ApiPropertyOptional({ description: "Search by name, email, or phone" })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({ enum: ROLE_FILTER_NAMES })
  @IsOptional()
  @IsString()
  @IsIn([...ROLE_FILTER_NAMES])
  roleName?: string

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

  @ApiPropertyOptional({ description: "Filter by active status" })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean
}
