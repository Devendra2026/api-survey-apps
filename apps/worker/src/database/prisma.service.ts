import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { createPrismaClient, PrismaClient } from "@workspace/database"

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient

  constructor(configService: ConfigService) {
    this.client = createPrismaClient({
      connectionString: configService.get<string>("DATABASE_URL"),
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
