import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { AppModule } from "./app.module.js"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)

  const corsOrigin = configService.get<string>("CORS_ORIGIN") ?? "http://localhost:3000"
  app.enableCors({
    origin: corsOrigin.split(",").map((origin) => origin.trim()),
    credentials: true,
  })

  const port = configService.get<number>("PORT") ?? 4000
  await app.listen(port)
}

void bootstrap()
