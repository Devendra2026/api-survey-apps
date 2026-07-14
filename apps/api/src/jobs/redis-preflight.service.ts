import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Redis } from "ioredis"
import { redisConnectionOptions } from "./redis-connection.js"

@Injectable()
export class RedisPreflightService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPreflightService.name)
  private client: Redis | undefined

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>("REDIS_URL")
    this.client = new Redis(redisConnectionOptions(redisUrl))
    this.client.on("error", () => {
      // Preflight below turns connection failures into one actionable startup error.
    })

    try {
      const pong = await this.client.ping()
      if (pong !== "PONG") {
        throw new Error(`Unexpected Redis PING response: ${pong}`)
      }
      this.logger.log("Redis connected")
    } catch (error) {
      this.client.disconnect()
      throw new Error(
        `Redis is not running or REDIS_URL is incorrect (${redactRedisUrl(redisUrl)}). ` +
          "Start Docker Compose or configure REDIS_URL. " +
          `Original error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => this.client?.disconnect())
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
