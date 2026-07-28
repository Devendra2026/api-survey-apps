import { ValidationPipe } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NestFactory } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import compression from "compression"
import helmet from "helmet"
import { randomUUID } from "node:crypto"
import { pinoHttp } from "pino-http"
import { AppModule } from "./app.module.js"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const configService = app.get(ConfigService)
  const nodeEnv = configService.get<string>("NODE_ENV") ?? "development"

  app.enableShutdownHooks()

  let closing = false
  const shutdown = async () => {
    if (closing) return
    closing = true
    await app.close()
    process.exit(0)
  }

  process.once("SIGTERM", () => {
    void shutdown()
  })
  process.once("SIGINT", () => {
    void shutdown()
  })

  app.use(helmet())
  app.use(compression())
  app.use(
    pinoHttp({
      genReqId: (req, res) => {
        const header = req.headers["x-request-id"]
        const fromHeader = Array.isArray(header) ? header[0] : header
        const requestId = typeof fromHeader === "string" && fromHeader.length > 0 ? fromHeader : randomUUID()
        res.setHeader("x-request-id", requestId)
        return requestId
      },
      level: configService.get<string>("LOG_LEVEL") ?? (nodeEnv === "production" ? "info" : "debug"),
    })
  )

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

  // Keep bootstrap generic: environment validation owns fail-fast configuration checks.
  const bootstrapAdmins = (configService.get<string>("BOOTSTRAP_ADMIN_CLERK_USER_IDS") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
  if (bootstrapAdmins.length > 0) {
    console.log(`BOOTSTRAP_ADMIN_CLERK_USER_IDS configured (${bootstrapAdmins.length} id(s))`)
  } else {
    console.warn("BOOTSTRAP_ADMIN_CLERK_USER_IDS is empty — first Clerk signup will stay Pending User")
  }

  const port = configService.get<number>("PORT") ?? configService.get<number>("APP_PORT") ?? 4000
  // Bind all interfaces so Docker / Swarm / Traefik can reach the container.
  const host = configService.get<string>("HOSTNAME") ?? "0.0.0.0"
  await app.listen(port, host)
}

void bootstrap()
