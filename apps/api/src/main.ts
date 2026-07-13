import { ValidationPipe } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { AppModule } from "./app.module.js"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)
  const nodeEnv = configService.get<string>("NODE_ENV") ?? "development"

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    })
  )

  const corsOrigin = configService.get<string>("CORS_ORIGIN") ?? "http://localhost:3000"
  app.enableCors({
    origin: corsOrigin.split(",").map((origin) => origin.trim()),
    credentials: true,
  })

  const swaggerFlag = configService.get<string>("SWAGGER_ENABLED")
  const swaggerEnabled = swaggerFlag === "true" || (swaggerFlag !== "false" && nodeEnv !== "production")
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Municipal Property Tax Survey API")
      .setDescription("NestJS backend for survey management with Clerk auth, RBAC, S3, and reporting")
      .setVersion("1.0")
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup("docs", app, document)
  }

  const port = configService.get<number>("PORT") ?? configService.get<number>("APP_PORT") ?? 4000
  await app.listen(port)
}

void bootstrap()
