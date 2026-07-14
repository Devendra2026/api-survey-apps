import { plainToInstance, Transform, Type } from "class-transformer"
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Max, Min, validateSync } from "class-validator"

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

export class WorkerEnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  WORKER_PORT = 4001

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  DIRECT_URL?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  REDIS_URL?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  LOG_LEVEL?: string

  @IsEnum(StorageProvider)
  STORAGE_PROVIDER: StorageProvider = StorageProvider.S3

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  STORAGE_BUCKET?: string

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
  @IsString()
  MINIO_BUCKET?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  MINIO_REGION?: string

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
  AWS_ACCESS_KEY_ID?: string

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  AWS_SECRET_ACCESS_KEY?: string
}

export function validateWorkerEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(WorkerEnvironmentVariables, config, {
    enableImplicitConversion: true,
  })
  const errors = validateSync(validated, { skipMissingProperties: false })
  const messages = errors.map((e) => Object.values(e.constraints ?? {}).join(", ")).filter(Boolean)

  if (!validated.REDIS_URL) {
    messages.push(
      "REDIS_URL is required because the worker consumes BullMQ jobs. " +
        "For local development start Docker Compose and set REDIS_URL=redis://localhost:6379; " +
        "inside Docker/Dokploy use REDIS_URL=redis://redis:6379."
    )
  }

  if (validated.STORAGE_PROVIDER === StorageProvider.Minio) {
    requireValues(
      validated,
      ["MINIO_ENDPOINT", "MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD", "MINIO_BUCKET"],
      messages,
      "STORAGE_PROVIDER=minio"
    )
  }

  if (validated.STORAGE_PROVIDER === StorageProvider.S3) {
    requireValues(validated, ["AWS_REGION", "AWS_S3_BUCKET"], messages, "STORAGE_PROVIDER=s3")
  }

  if (messages.length > 0) {
    throw new Error(`Worker environment validation failed: ${messages.join("; ")}`)
  }

  return validated
}

function requireValues(
  values: WorkerEnvironmentVariables,
  keys: Array<keyof WorkerEnvironmentVariables>,
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
