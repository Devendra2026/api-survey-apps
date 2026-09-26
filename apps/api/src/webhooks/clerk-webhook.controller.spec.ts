import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import { ClerkWebhookController } from "./clerk-webhook.controller.js"
import type { ClerkWebhookService } from "./clerk-webhook.service.js"

describe("ClerkWebhookController", () => {
  let controller: ClerkWebhookController
  const handleEvent = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    const config = {
      get: jest.fn((key: string) => (key === "CLERK_WEBHOOK_SIGNING_SECRET" ? undefined : undefined)),
    } as unknown as ConfigService
    const service = { handleEvent } as unknown as ClerkWebhookService
    controller = new ClerkWebhookController(config, service)
  })

  it("rejects when signing secret is not configured", async () => {
    await expect(
      controller.handleClerk(
        {
          rawBody: Buffer.from("{}"),
          protocol: "https",
          get: () => "localhost",
          originalUrl: "/webhooks/clerk",
        } as never,
        {}
      )
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(handleEvent).not.toHaveBeenCalled()
  })

  it("rejects when raw body is missing", async () => {
    const config = {
      get: jest.fn(() => "whsec_test"),
    } as unknown as ConfigService
    const service = { handleEvent } as unknown as ClerkWebhookService
    controller = new ClerkWebhookController(config, service)

    await expect(
      controller.handleClerk(
        { rawBody: undefined, protocol: "https", get: () => "localhost", originalUrl: "/webhooks/clerk" } as never,
        {}
      )
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
