import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { createPrismaClient, PrismaClient } from "@workspace/database"

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient

  constructor(private readonly configService: ConfigService) {
    this.client = createPrismaClient({
      connectionString: this.configService.get<string>("DATABASE_URL"),
    })
  }

  get prisma(): PrismaClient {
    return this.client
  }

  async onModuleInit() {
    await this.client.$connect()
  }

  async onModuleDestroy() {
    await this.client.$disconnect()
  }
}
