import { plainToInstance, Transform, Type } from "class-transformer"
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from "class-validator"

/** Empty env values (`KEY=`) become undefined so @IsOptional skips them. */
function emptyToUndefined({ value }: { value: unknown }) {
  if (value === "" || value === null) return undefined
  return value
}

enum NodeEnv {
  Development = "development",
  Production = "production",
  Test = "test",
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development

  // @Type needed: TS emits design:type Object when the field has a numeric default,
  // so enableImplicitConversion alone leaves env PORT as a string and @IsInt fails.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN!: string

  @IsOptional()
  @IsString()
  CLERK_SECRET_KEY?: string

  @IsOptional()
  @IsString()
  CLERK_PUBLISHABLE_KEY?: string

  @IsOptional()
  @IsString()
  CLERK_AUTHORIZED_PARTIES?: string

  @IsOptional()
  @IsBooleanString()
  SWAGGER_ENABLED?: string

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  AWS_ACCESS_KEY_ID?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  AWS_SECRET_ACCESS_KEY?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  AWS_REGION?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  AWS_S3_BUCKET?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ require_tld: false })
  AWS_S3_PUBLIC_URL?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsInt()
  @Min(1024)
  AWS_S3_MAX_FILE_SIZE_BYTES?: number

  @IsOptional()
  @IsString()
  JWT_AUDIENCE?: string

  @IsOptional()
  @IsString()
  JWT_ISSUER?: string
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  })
  const errors = validateSync(validated, { skipMissingProperties: false })
  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints ?? {}).join(", "))
      .filter(Boolean)
      .join("; ")
    throw new Error(`Environment validation failed: ${messages}`)
  }

  if (validated.NODE_ENV === NodeEnv.Production && !validated.CLERK_SECRET_KEY) {
    throw new Error("Environment validation failed: CLERK_SECRET_KEY is required in production")
  }

  return validated
}
