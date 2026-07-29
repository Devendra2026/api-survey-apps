import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { ensureAccessBootstrap } from "@workspace/database"
import { PrismaService } from "../../prisma/prisma.service.js"

/**
 * On API boot: ensure RBAC catalog exists and promote BOOTSTRAP_ADMIN_CLERK_USER_IDS.
 * Prevents dashboard HTTP 403 when production never ran a manual catalog seed.
 */
@Injectable()
export class AccessBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AccessBootstrapService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async onModuleInit() {
    const result = await ensureAccessBootstrap(this.prisma.db, {
      bootstrapAdminClerkUserIds: this.configService.get<string>("BOOTSTRAP_ADMIN_CLERK_USER_IDS"),
      seedAdminClerkUserId: this.configService.get<string>("SEED_ADMIN_CLERK_USER_ID"),
    })

    if (result.rbacEnsured) {
      this.logger.log("RBAC catalog was missing — seeded permissions and roles on startup")
    }

    if (result.adminClerkUserIds.length === 0) {
      this.logger.warn(
        "No BOOTSTRAP_ADMIN_CLERK_USER_IDS / SEED_ADMIN_CLERK_USER_ID — new signups stay Pending User (dashboard 403)"
      )
      return
    }

    if (result.promoted.length > 0) {
      this.logger.log(`Promoted bootstrap ADMIN for: ${result.promoted.join(", ")}`)
    }
    if (result.alreadyAdmin.length > 0) {
      this.logger.log(`Bootstrap ADMIN already assigned for: ${result.alreadyAdmin.join(", ")}`)
    }
    for (const failure of result.failed) {
      this.logger.error(`Bootstrap ADMIN failed for ${failure.clerkUserId}: ${failure.reason}`)
    }
  }
}
