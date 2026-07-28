import { Controller, Get, Header, ServiceUnavailableException } from "@nestjs/common"
import { collectDefaultMetrics, Registry } from "prom-client"
import { RedisHealthService } from "../redis/redis-health.service.js"

const metricsRegistry = new Registry()
collectDefaultMetrics({ register: metricsRegistry, prefix: "worker_" })

@Controller()
export class HealthController {
  constructor(private readonly redisHealthService: RedisHealthService) {}

  @Get("live")
  live() {
    return { status: "ok" }
  }

  @Get("metrics")
  @Header("Content-Type", metricsRegistry.contentType)
  async metrics(): Promise<string> {
    return metricsRegistry.metrics()
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
