import { Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import "reflect-metadata"
import { WorkerModule } from "./worker.module.js"

async function bootstrap() {
  const logger = new Logger("WorkerBootstrap")
  const app = await NestFactory.create(WorkerModule)
  const configService = app.get(ConfigService)
  const port = configService.get<number>("WORKER_PORT") ?? 4001

  app.enableShutdownHooks()

  let closing = false
  const shutdown = async (signal: string) => {
    if (closing) return
    closing = true
    logger.log(`Received ${signal}; closing worker gracefully`)
    await app.close()
    process.exit(0)
  }

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM")
  })
  process.once("SIGINT", () => {
    void shutdown("SIGINT")
  })

  await app.listen(port)
  logger.log(`Worker listening on ${port}`)
}

void bootstrap()
