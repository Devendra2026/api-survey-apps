import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { JOB_QUEUE_NAMES } from "@workspace/jobs"
import { monorepoEnvFiles } from "./config/env-files.js"
import { validateWorkerEnv } from "./config/env.validation.js"
import { PrismaService } from "./database/prisma.service.js"
import { ExportWorkerService } from "./exports/export-worker.service.js"
import { ExportsProcessor } from "./exports/exports.processor.js"
import { HealthController } from "./health/health.controller.js"
import { ImageMigrationProcessor } from "./images/image-migration.processor.js"
import { ImageMigrationService } from "./images/image-migration.service.js"
import { ImportWorkerService } from "./imports/import-worker.service.js"
import { ImportsProcessor } from "./imports/imports.processor.js"
import { redisConnectionOptions } from "./redis/redis-connection.js"
import { RedisHealthService } from "./redis/redis-health.service.js"
import { StorageCleanupProcessor } from "./storage-cleanup/storage-cleanup.processor.js"
import { StorageCleanupService } from "./storage-cleanup/storage-cleanup.service.js"
import { ObjectStorageService } from "./storage/object-storage.service.js"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: monorepoEnvFiles(),
      expandVariables: true,
      cache: true,
      validate: validateWorkerEnv,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: redisConnectionOptions(configService.get<string>("REDIS_URL")),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 1_000 },
          removeOnComplete: { count: 1_000 },
          removeOnFail: { count: 5_000 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: JOB_QUEUE_NAMES.imports },
      { name: JOB_QUEUE_NAMES.exports },
      { name: JOB_QUEUE_NAMES.storageCleanup },
      { name: JOB_QUEUE_NAMES.imageMigration }
    ),
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    RedisHealthService,
    ObjectStorageService,
    ImportWorkerService,
    ExportWorkerService,
    StorageCleanupService,
    ImageMigrationService,
    ImportsProcessor,
    ExportsProcessor,
    StorageCleanupProcessor,
    ImageMigrationProcessor,
  ],
})
export class WorkerModule {}
