import { Controller, Get, ServiceUnavailableException } from "@nestjs/common"
import { RedisHealthService } from "../redis/redis-health.service.js"

@Controller()
export class HealthController {
  constructor(private readonly redisHealthService: RedisHealthService) {}

  @Get("live")
  live() {
    return { status: "ok" }
  }

  @Get("ready")
  async ready() {
    const redisReady = await this.redisHealthService.ping()
    if (!redisReady) {
      throw new ServiceUnavailableException("Redis is not ready")
    }
    return { status: "ok", redis: "ok" }
  }
}
