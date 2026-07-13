import { Controller, Get, ServiceUnavailableException } from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"
import { Public } from "../common/decorators/public.decorator.js"
import { PrismaService } from "../prisma/prisma.service.js"

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    }
  }

  @Public()
  @Get("ready")
  async getReady() {
    try {
      await this.prisma.db.$queryRaw`SELECT 1`
      return {
        status: "ready",
        database: "up",
        timestamp: new Date().toISOString(),
      }
    } catch {
      throw new ServiceUnavailableException({
        status: "not_ready",
        database: "down",
        timestamp: new Date().toISOString(),
      })
    }
  }
}
