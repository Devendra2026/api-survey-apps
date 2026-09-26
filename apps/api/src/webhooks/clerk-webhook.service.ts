import { Injectable, Logger } from "@nestjs/common"
import { UsersRepository } from "../users/users.repository.js"
import { UserUpsertService } from "../users/user-upsert.service.js"
import { isPendingClerkUserId } from "../users/pending-clerk-id.util.js"

type ClerkEmailAddress = {
  id?: string
  email_address?: string
}

type ClerkPhoneNumber = {
  id?: string
  phone_number?: string
}

/** Subset of Clerk user.created / user.updated payload fields we sync. */
export type ClerkWebhookUserData = {
  id: string
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  primary_email_address_id?: string | null
  email_addresses?: ClerkEmailAddress[]
  primary_phone_number_id?: string | null
  phone_numbers?: ClerkPhoneNumber[]
}

export type ClerkWebhookEvent = {
  type: string
  data: ClerkWebhookUserData
}

@Injectable()
export class ClerkWebhookService {
  private readonly logger = new Logger(ClerkWebhookService.name)

  constructor(
    private readonly userUpsert: UserUpsertService,
    private readonly usersRepository: UsersRepository
  ) {}

  async handleEvent(event: ClerkWebhookEvent): Promise<{ handled: boolean; action: string }> {
    switch (event.type) {
      case "user.created":
      case "user.updated":
        return this.upsertFromClerkUser(event.data, event.type)
      case "user.deleted":
        return this.deactivateFromClerkUser(event.data)
      default:
        this.logger.debug(`Ignoring Clerk webhook type=${event.type}`)
        return { handled: false, action: "ignored" }
    }
  }

  private async upsertFromClerkUser(
    data: ClerkWebhookUserData,
    eventType: string
  ): Promise<{ handled: boolean; action: string }> {
    const clerkUserId = data.id?.trim()
    if (!clerkUserId || isPendingClerkUserId(clerkUserId)) {
      this.logger.warn(`Clerk webhook ${eventType} missing valid user id`)
      return { handled: false, action: "skipped" }
    }

    const email = this.resolveEmail(data)
    if (!email) {
      this.logger.warn(`Clerk webhook ${eventType} skipped — no email for ${clerkUserId}`)
      return { handled: false, action: "skipped" }
    }

    const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || data.username || email
    const phone = this.resolvePhone(data)

    const result = await this.userUpsert.upsert({
      clerkUserId,
      email,
      fullName,
      phone,
      source: "clerk-sync",
    })

    this.logger.log(`Clerk webhook ${eventType} clerkUserId=${clerkUserId} upsert=${result.action}`)
    return { handled: true, action: result.action }
  }

  /**
   * Soft-deactivate only. Survey / audit / job history stays intact.
   * Idempotent: missing or already-inactive users return success.
   * Does not set deactivatedBy / SecurityAudit.actorId to the deleted user (avoids Restrict FK lock).
   */
  async deactivateFromClerkUser(data: Pick<ClerkWebhookUserData, "id">): Promise<{ handled: boolean; action: string }> {
    const clerkUserId = data.id?.trim()
    if (!clerkUserId || isPendingClerkUserId(clerkUserId)) {
      return { handled: true, action: "noop" }
    }

    const user = await this.usersRepository.findByClerkId(clerkUserId)
    if (!user) {
      this.logger.log(`Clerk user.deleted — no local user for ${clerkUserId}`)
      return { handled: true, action: "noop" }
    }

    const action = await this.usersRepository.deactivateIdentity({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      clerkUserId: user.clerkUserId,
      actorId: null,
      source: "clerk.user.deleted",
    })

    if (action === "deactivated") {
      this.logger.log(`Clerk user.deleted — deactivated userId=${user.id} clerkUserId=${clerkUserId}`)
    } else {
      this.logger.log(`Clerk user.deleted — already inactive userId=${user.id}`)
    }

    return { handled: true, action }
  }

  private resolveEmail(data: ClerkWebhookUserData): string | null {
    const addresses = data.email_addresses ?? []
    const primaryId = data.primary_email_address_id
    const primary = primaryId ? addresses.find((e) => e.id === primaryId) : undefined
    const email = (primary?.email_address ?? addresses[0]?.email_address)?.trim().toLowerCase()
    return email && email.includes("@") ? email : null
  }

  private resolvePhone(data: ClerkWebhookUserData): string | null {
    const phones = data.phone_numbers ?? []
    const primaryId = data.primary_phone_number_id
    const primary = primaryId ? phones.find((p) => p.id === primaryId) : undefined
    const phone = (primary?.phone_number ?? phones[0]?.phone_number)?.trim()
    return phone || null
  }
}
