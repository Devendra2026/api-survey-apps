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

enum StorageProvider {
  Minio = "minio",
  S3 = "s3",
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

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  DIRECT_URL?: string

  @IsString()
  @IsNotEmpty()
  CORS_ORIGIN!: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ require_tld: false })
  APP_URL?: string

  /** HMAC secret for demand-notice print/PDF routes (falls back to CLERK_SECRET_KEY). */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  DEMAND_NOTICE_PRINT_SECRET?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ require_tld: false })
  API_URL?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ require_tld: false })
  NEXT_PUBLIC_API_URL?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  CLERK_SECRET_KEY?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  CLERK_PUBLISHABLE_KEY?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  CLERK_AUTHORIZED_PARTIES?: string

  /** Comma-separated Clerk user IDs granted ADMIN (global scope) on first login if they have no roles. */
  @IsOptional()
  @IsString()
  BOOTSTRAP_ADMIN_CLERK_USER_IDS?: string

  /** Allowed clock skew (ms) when verifying Clerk JWTs. Defaults to 30000 if unset. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(300_000)
  CLERK_CLOCK_SKEW_MS?: number

  @IsOptional()
  @IsBooleanString()
  SWAGGER_ENABLED?: string

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  REDIS_URL?: string

  @IsEnum(StorageProvider)
  STORAGE_PROVIDER: StorageProvider = StorageProvider.S3

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  STORAGE_BUCKET?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1024)
  STORAGE_MAX_FILE_SIZE_BYTES?: number

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1024)
  UPLOAD_MAX_FILE_SIZE_BYTES?: number

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  UPLOAD_MAX_FILES?: number

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  MINIO_ROOT_USER?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  MINIO_ROOT_PASSWORD?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  MINIO_ACCESS_KEY?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  MINIO_SECRET_KEY?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ require_tld: false })
  MINIO_ENDPOINT?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ require_tld: false })
  MINIO_PUBLIC_URL?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  MINIO_BUCKET?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  MINIO_REGION?: string

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
  @IsString()
  AWS_S3_ENDPOINT?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsBooleanString()
  AWS_S3_FORCE_PATH_STYLE?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ require_tld: false })
  AWS_S3_PUBLIC_URL?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1024)
  AWS_S3_MAX_FILE_SIZE_BYTES?: number

  /** When true (and not production), allows `x-dev-clerk-user-id` without CLERK_SECRET_KEY. */
  @IsOptional()
  @IsString()
  ALLOW_DEV_AUTH?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ require_tld: false })
  CONVEX_SITE_URL?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  ETL_CONVEX_SECRET?: string

  @IsOptional()
  @IsBooleanString()
  ETL_ENABLED?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  ETL_CRON?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  ETL_BATCH_SIZE?: number

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  ETL_SYSTEM_USER_ID?: string
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

  const crossFieldErrors: string[] = []

  if (validated.NODE_ENV === NodeEnv.Production) {
    requireValues(validated, ["CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY"], crossFieldErrors, "production")
  }

  if (validated.STORAGE_PROVIDER === StorageProvider.Minio) {
    requireValues(
      validated,
      ["MINIO_ENDPOINT", "MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD", "MINIO_BUCKET"],
      crossFieldErrors,
      "STORAGE_PROVIDER=minio"
    )
  }

  if (validated.STORAGE_PROVIDER === StorageProvider.S3) {
    requireValues(validated, ["AWS_REGION", "AWS_S3_BUCKET"], crossFieldErrors, "STORAGE_PROVIDER=s3")
    if (Boolean(validated.AWS_ACCESS_KEY_ID) !== Boolean(validated.AWS_SECRET_ACCESS_KEY)) {
      crossFieldErrors.push("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be provided together")
    }
  }

  if (!validated.REDIS_URL) {
    crossFieldErrors.push(
      "REDIS_URL is required because API queues and readiness checks depend on Redis. " +
        "For local development start Docker Compose and set REDIS_URL=redis://localhost:6379; " +
        "inside Docker/Dokploy use REDIS_URL=redis://redis:6379."
    )
  }

  if (crossFieldErrors.length > 0) {
    throw new Error(`Environment validation failed: ${crossFieldErrors.join("; ")}`)
  }

  return validated
}

function requireValues(
  values: EnvironmentVariables,
  keys: Array<keyof EnvironmentVariables>,
  errors: string[],
  context: string
) {
  for (const key of keys) {
    const value = values[key]
    if (value === undefined || value === null || value === "") {
      errors.push(`${String(key)} is required when ${context}`)
    }
  }
}
