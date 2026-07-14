import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { JOB_QUEUE_NAMES } from "@workspace/jobs"
import { JobsService } from "./jobs.service.js"
import { redisConnectionOptions } from "./redis-connection.js"
import { RedisPreflightService } from "./redis-preflight.service.js"

@Module({
  imports: [
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
  providers: [RedisPreflightService, JobsService],
  exports: [BullModule, JobsService],
})
export class JobsModule {}
