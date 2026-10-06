import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { createPrismaClient, PrismaClient } from "@workspace/database"

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient

  constructor(configService: ConfigService) {
    // Separate from the API pool. No statement timeout: ETL and PDF jobs can run longer than a request.
    this.client = createPrismaClient({
      connectionString: configService.get<string>("DATABASE_URL"),
      pool: {
        max: 10,
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 30_000,
        applicationName: "survey-worker",
      },
    })
  }

  get db(): PrismaClient {
    return this.client
  }

  async onModuleInit() {
    await this.client.$connect()
  }

  async onModuleDestroy() {
    await this.client.$disconnect()
  }
}
