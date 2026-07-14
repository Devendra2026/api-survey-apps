import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Redis } from "ioredis"
import { redisConnectionOptions } from "./redis-connection.js"

@Injectable()
export class RedisHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisHealthService.name)
  private readonly client: Redis
  private readonly redisUrl: string | undefined

  constructor(configService: ConfigService) {
    this.redisUrl = configService.get<string>("REDIS_URL")
    this.client = new Redis(redisConnectionOptions(this.redisUrl))
    this.client.on("error", () => {
      // Preflight below turns connection failures into one actionable startup error.
    })
  }

  async onModuleInit() {
    try {
      const connected = await this.ping()
      if (!connected) {
        throw new Error("PING did not return PONG")
      }
      this.logger.log("Redis connected")
    } catch (error) {
      this.client.disconnect()
      throw new Error(
        `Redis is not running or REDIS_URL is incorrect (${redactRedisUrl(this.redisUrl)}). ` +
          "Start Docker Compose or configure REDIS_URL. " +
          `Original error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  async ping(): Promise<boolean> {
    return (await this.client.ping()) === "PONG"
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => this.client.disconnect())
  }
}

function redactRedisUrl(redisUrl: string | undefined): string {
  if (!redisUrl) return "unset"
  try {
    const url = new URL(redisUrl)
    if (url.password) url.password = "****"
    return url.toString()
  } catch {
    return "invalid REDIS_URL"
  }
}
