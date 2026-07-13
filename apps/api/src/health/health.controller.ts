import { Controller, Get, ServiceUnavailableException } from "@nestjs/common"
import { DatabaseService } from "../database/database.service.js"

@Controller("health")
export class HealthController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    }
  }

  @Get("ready")
  async getReady() {
    try {
      await this.databaseService.prisma.$queryRaw`SELECT 1`
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
