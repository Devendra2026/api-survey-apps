import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import type { UserUpsertService } from "../users/user-upsert.service.js"
import type { UsersRepository } from "../users/users.repository.js"
import { ClerkWebhookService } from "./clerk-webhook.service.js"

describe("ClerkWebhookService", () => {
  const upsert = jest.fn<UserUpsertService["upsert"]>()
  const findByClerkId = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const deactivateIdentity = jest.fn<(...args: unknown[]) => Promise<"deactivated" | "noop">>()

  let service: ClerkWebhookService

  beforeEach(() => {
    jest.clearAllMocks()
    const usersRepository = {
      findByClerkId,
      deactivateIdentity,
    } as unknown as UsersRepository
    const userUpsert = { upsert } as unknown as UserUpsertService
    service = new ClerkWebhookService(userUpsert, usersRepository)
  })

  it("upserts on user.created when email is present", async () => {
    upsert.mockResolvedValue({
      action: "created",
      userId: "u1",
      clerkUserId: "user_abc",
      email: "a@example.com",
      warnings: [],
    })

    const result = await service.handleEvent({
      type: "user.created",
      data: {
        id: "user_abc",
        first_name: "Ada",
        last_name: "Lovelace",
        email_addresses: [{ id: "em_1", email_address: "a@example.com" }],
        primary_email_address_id: "em_1",
      },
    })

    expect(result).toEqual({ handled: true, action: "created" })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: "user_abc",
        email: "a@example.com",
        fullName: "Ada Lovelace",
        source: "clerk-sync",
      })
    )
  })

  it("deactivates an active user on user.deleted without self-FK actor", async () => {
    findByClerkId.mockResolvedValue({
      id: "u1",
      email: "a@example.com",
      fullName: "Ada",
      clerkUserId: "user_abc",
      isActive: true,
    })
    deactivateIdentity.mockResolvedValue("deactivated")

    const first = await service.handleEvent({
      type: "user.deleted",
      data: { id: "user_abc" },
    })
    expect(first).toEqual({ handled: true, action: "deactivated" })
    expect(deactivateIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        actorId: null,
        source: "clerk.user.deleted",
      })
    )
  })

  it("is idempotent when user.deleted is delivered twice", async () => {
    findByClerkId
      .mockResolvedValueOnce({
        id: "u1",
        email: "a@example.com",
        fullName: "Ada",
        clerkUserId: "user_abc",
        isActive: true,
      })
      .mockResolvedValueOnce({
        id: "u1",
        email: "a@example.com",
        fullName: "Ada",
        clerkUserId: "user_abc",
        isActive: false,
      })
    deactivateIdentity.mockResolvedValueOnce("deactivated").mockResolvedValueOnce("noop")

    const first = await service.deactivateFromClerkUser({ id: "user_abc" })
    const second = await service.deactivateFromClerkUser({ id: "user_abc" })

    expect(first.action).toBe("deactivated")
    expect(second.action).toBe("noop")
    expect(deactivateIdentity).toHaveBeenCalledTimes(2)
  })

  it("returns noop when deleted Clerk user has no local row", async () => {
    findByClerkId.mockResolvedValue(null)
    const result = await service.handleEvent({
      type: "user.deleted",
      data: { id: "user_missing" },
    })
    expect(result).toEqual({ handled: true, action: "noop" })
    expect(deactivateIdentity).not.toHaveBeenCalled()
  })
})
