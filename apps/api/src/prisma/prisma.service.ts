import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { createPrismaClient, PrismaClient } from "@workspace/database"

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient

  constructor(private readonly configService: ConfigService) {
    // Pool of 10. Worker uses its own pool of 10. Postgres max_connections stays at the
    // image default (100), which still leaves room for migrate and admin sessions.
    this.client = createPrismaClient({
      connectionString: this.configService.get<string>("DATABASE_URL"),
      pool: {
        max: 10,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 30_000,
        statementTimeoutMillis: 30_000,
        queryTimeoutMillis: 30_000,
        idleInTransactionTimeoutMillis: 20_000,
        applicationName: "survey-api",
      },
    })
  }

  get prisma(): PrismaClient {
    return this.client
  }

  /** Direct access for repositories that prefer `this.prisma.survey` style. */
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
