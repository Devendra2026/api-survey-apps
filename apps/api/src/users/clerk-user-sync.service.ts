import { createClerkClient } from "@clerk/backend"
import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { UserUpsertService } from "./user-upsert.service.js"

export type ClerkSyncSummary = {
  created: number
  updated: number
  skipped: number
  errors: Array<{ clerkUserId?: string; email?: string; message: string }>
  totalFetched: number
}

@Injectable()
export class ClerkUserSyncService {
  private readonly logger = new Logger(ClerkUserSyncService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly userUpsert: UserUpsertService
  ) {}

  async syncFromClerk(): Promise<ClerkSyncSummary> {
    const secretKey = this.configService.get<string>("CLERK_SECRET_KEY")
    if (!secretKey) {
      throw new BadRequestException("CLERK_SECRET_KEY is not configured")
    }

    const clerk = createClerkClient({ secretKey })
    const summary: ClerkSyncSummary = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      totalFetched: 0,
    }

    const limit = 100
    let offset = 0
    let totalCount = Number.POSITIVE_INFINITY

    while (offset < totalCount) {
      const page = await clerk.users.getUserList({ limit, offset, orderBy: "-created_at" })
      totalCount = page.totalCount
      const users = page.data
      if (!users.length) break

      for (const clerkUser of users) {
        summary.totalFetched += 1
        const email =
          clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
          clerkUser.emailAddresses[0]?.emailAddress

        if (!email) {
          summary.skipped += 1
          summary.errors.push({
            clerkUserId: clerkUser.id,
            message: "Skipped — no email address on Clerk user",
          })
          continue
        }

        const fullName =
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || clerkUser.username || email
        const phone = clerkUser.primaryPhoneNumber?.phoneNumber ?? null

        try {
          const result = await this.userUpsert.upsert({
            clerkUserId: clerkUser.id,
            email,
            fullName,
            phone,
            source: "clerk-sync",
          })
          if (result.action === "created") summary.created += 1
          else if (result.action === "updated") summary.updated += 1
          else summary.skipped += 1
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upsert failed"
          this.logger.warn(`Clerk sync failed for ${clerkUser.id}: ${message}`)
          summary.errors.push({ clerkUserId: clerkUser.id, email, message })
        }
      }

      offset += users.length
      if (users.length < limit) break
    }

    this.logger.log(
      `Clerk sync complete fetched=${summary.totalFetched} created=${summary.created} updated=${summary.updated} errors=${summary.errors.length}`
    )
    return summary
  }
}
