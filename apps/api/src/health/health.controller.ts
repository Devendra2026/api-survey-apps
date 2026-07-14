import { Controller, Get, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { ApiTags } from "@nestjs/swagger"
import net from "node:net"
import { Public } from "../common/decorators/public.decorator.js"
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
    try {
      const parsed = new URL(redisUrl)
      const port = Number(parsed.port || (parsed.protocol === "rediss:" ? 6380 : 6379))
      return await new Promise<boolean>((resolve) => {
        const socket = net.createConnection({ host: parsed.hostname, port })
        const timeout = setTimeout(() => {
          socket.destroy()
          resolve(false)
        }, 1500)

        socket.once("connect", () => {
          clearTimeout(timeout)
          socket.end()
          resolve(true)
        })
        socket.once("error", () => {
          clearTimeout(timeout)
          resolve(false)
        })
      })
    } catch {
      return false
    }
  }
}
