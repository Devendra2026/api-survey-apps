import { Controller, Get, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { ApiTags } from "@nestjs/swagger"
import { Redis } from "ioredis"
import { Public } from "../common/decorators/public.decorator.js"
import { redisConnectionOptions } from "../jobs/redis-connection.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { StorageService } from "../storage/storage.service.js"

@ApiTags("health")
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService
  ) {}

  @Public()
  @Get("health")
  getHealth() {
    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    }
  }

  @Public()
  @Get("live")
  getLive() {
    return {
      status: "live",
      service: "api",
      timestamp: new Date().toISOString(),
    }
  }

  @Public()
  @Get("ready")
  async getReady() {
    const checks: Record<string, string> = {}

    try {
      await this.prisma.db.$queryRaw`SELECT 1`
      checks.database = "up"
    } catch {
      checks.database = "down"
    }

    const redisUrl = this.configService.get<string>("REDIS_URL")
    if (redisUrl) {
      checks.redis = (await this.checkRedis(redisUrl)) ? "up" : "down"
    }

    try {
      const storage = await this.storageService.healthCheck()
      checks.storage = storage.healthy ? "up" : "down"
    } catch {
      checks.storage = "down"
    }

    const ready = Object.values(checks).every((value) => value === "up")
    if (ready) {
      return {
        status: "ready",
        checks,
        timestamp: new Date().toISOString(),
      }
    }

    throw new ServiceUnavailableException({
      status: "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    })
  }

  private async checkRedis(redisUrl: string) {
    const client = new Redis({
      ...redisConnectionOptions(redisUrl),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    })
    try {
      await client.connect()
      return (await client.ping()) === "PONG"
    } catch {
      return false
    } finally {
      await client.quit().catch(() => client.disconnect())
    }
  }
}
