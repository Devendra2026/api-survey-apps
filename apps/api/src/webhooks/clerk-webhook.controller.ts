import { verifyWebhook } from "@clerk/backend/webhooks"
import type { RawBodyRequest } from "@nestjs/common"
import { BadRequestException, Controller, Headers, Logger, Post, Req } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { ApiExcludeController } from "@nestjs/swagger"
import { SkipThrottle } from "@nestjs/throttler"
import type { Request as ExpressRequest } from "express"
import { Public } from "../common/decorators/public.decorator.js"
import { ClerkWebhookService, type ClerkWebhookEvent } from "./clerk-webhook.service.js"

type WebhookIncomingRequest = RawBodyRequest<ExpressRequest>

@ApiExcludeController()
@Controller("webhooks")
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly clerkWebhookService: ClerkWebhookService
  ) {}

  @Public()
  @SkipThrottle()
  @Post("clerk")
  async handleClerk(
    @Req() req: WebhookIncomingRequest,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    const signingSecret = this.configService.get<string>("CLERK_WEBHOOK_SIGNING_SECRET")
    if (!signingSecret) {
      this.logger.warn("CLERK_WEBHOOK_SIGNING_SECRET is not configured — rejecting webhook")
      throw new BadRequestException("Webhook signing secret is not configured")
    }

    const rawBody = req.rawBody
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException("Missing raw request body")
    }

    let event: ClerkWebhookEvent
    try {
      const webhookRequest = this.toFetchRequest(req, headers, rawBody)
      const verified = await verifyWebhook(webhookRequest, { signingSecret })
      event = {
        type: verified.type,
        data: verified.data as ClerkWebhookEvent["data"],
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Webhook verification failed"
      this.logger.warn(`Clerk webhook verification failed: ${message}`)
      throw new BadRequestException("Invalid webhook signature")
    }

    const result = await this.clerkWebhookService.handleEvent(event)
    return {
      received: true,
      type: event.type,
      ...result,
    }
  }

  private toFetchRequest(
    req: ExpressRequest,
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer
  ): globalThis.Request {
    const protocol = req.protocol || "https"
    const host = req.get("host") || "localhost"
    const url = `${protocol}://${host}${req.originalUrl}`
    const fetchHeaders = new globalThis.Headers()
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === "string") {
        fetchHeaders.set(key, value)
      } else if (Array.isArray(value)) {
        fetchHeaders.set(key, value.join(","))
      }
    }
    return new globalThis.Request(url, {
      method: "POST",
      headers: fetchHeaders,
      body: new Uint8Array(rawBody),
    })
  }
}
