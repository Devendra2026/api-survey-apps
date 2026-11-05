import { Controller, Get, Header, type OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { ApiTags } from "@nestjs/swagger"
import { SkipThrottle } from "@nestjs/throttler"
import { Redis } from "ioredis"
import { collectDefaultMetrics, Registry } from "prom-client"
import { Public } from "../common/decorators/public.decorator.js"
import { redisConnectionOptions } from "../jobs/redis-connection.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { StorageService } from "../storage/storage.service.js"

const metricsRegistry = new Registry()
collectDefaultMetrics({ register: metricsRegistry, prefix: "api_" })

@ApiTags("health")
@Controller()
export class HealthController implements OnModuleDestroy {
  private redisProbe: Redis | null = null

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
  @SkipThrottle()
  @Get("live")
  getLive() {
    return {
      status: "live",
      service: "api",
      timestamp: new Date().toISOString(),
    }
  }

  @Public()
  @Get("metrics")
  @Header("Content-Type", metricsRegistry.contentType)
  async getMetrics(): Promise<string> {
    return metricsRegistry.metrics()
  }

  @Public()
  @SkipThrottle()
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

  /**
   * One long-lived probe connection instead of connect/quit per request: `/ready` is public and
   * unthrottled, so a per-call socket turned every orchestrator probe (or a flood) into connection churn.
   */
  private async checkRedis(redisUrl: string) {
    if (!this.redisProbe) {
      this.redisProbe = new Redis({
        ...redisConnectionOptions(redisUrl),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 2_000,
      })
      // Errors surface through ping(); without a listener ioredis logs every reconnect attempt as unhandled.
      this.redisProbe.on("error", () => undefined)
    }
    const client = this.redisProbe
    try {
      if (client.status === "wait" || client.status === "end") {
        await client.connect()
      }
      return (await client.ping()) === "PONG"
    } catch {
      return false
    }
  }

  async onModuleDestroy() {
    const client = this.redisProbe
    this.redisProbe = null
    if (client) await client.quit().catch(() => client.disconnect())
  }
}
