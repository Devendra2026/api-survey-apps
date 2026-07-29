import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { promoteUserToAdmin } from "@workspace/database"
import { PrismaService } from "../../prisma/prisma.service.js"

/**
 * Bootstraps ADMIN when:
 * - clerkUserId is listed in BOOTSTRAP_ADMIN_CLERK_USER_IDS, or
 * - no signed-in ADMIN exists yet (first real login becomes admin).
 * Otherwise the caller assigns PENDING_APPROVAL.
 */
@Injectable()
export class RoleProvisioningService {
  private readonly logger = new Logger(RoleProvisioningService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async ensureBootstrapAdmin(userId: string, clerkUserId: string): Promise<boolean> {
    const bootstrapIds = this.parseBootstrapIds()
    const listed = bootstrapIds.has(clerkUserId)
    const allowFirstAdmin = listed ? false : await this.hasNoSignedInAdmin()

    if (!listed && !allowFirstAdmin) {
      return false
    }

    const result = await promoteUserToAdmin(this.prisma.db, userId)
    if (result.status === "admin-role-not-found") {
      this.logger.error("ADMIN role not found — run db seed / wait for access bootstrap on startup")
      return false
    }

    if (result.status === "promoted") {
      this.logger.log(
        listed
          ? `Bootstrapped ADMIN for configured clerkUserId=${clerkUserId}`
          : `Bootstrapped first signed-in ADMIN for clerkUserId=${clerkUserId}`
      )
    }
    return true
  }

  /**
   * Assigns PENDING_APPROVAL when the user has no active tenant roles
   * (and was not bootstrapped as ADMIN).
   */
  async ensurePendingApproval(userId: string): Promise<boolean> {
    const existing = await this.prisma.db.userTenantRole.findFirst({
      where: { userId, isActive: true },
      select: { id: true },
    })
    if (existing) {
      return false
    }

    const pendingRole = await this.prisma.db.role.findUnique({
      where: { name: "PENDING_APPROVAL" },
      select: { id: true },
    })
    if (!pendingRole) {
      this.logger.error("PENDING_APPROVAL role not found — run db seed")
      return false
    }

    await this.prisma.db.userTenantRole.create({
      data: {
        userId,
        roleId: pendingRole.id,
        assignedBy: userId,
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    })

    this.logger.log(`Assigned PENDING_APPROVAL for userId=${userId}`)
    return true
  }

  /** True when no active ADMIN assignment belongs to a user who has signed in. */
  private async hasNoSignedInAdmin(): Promise<boolean> {
    const signedInAdmins = await this.prisma.db.userTenantRole.count({
      where: {
        isActive: true,
        role: { name: "ADMIN" },
        user: { lastLoginAt: { not: null } },
      },
    })
    return signedInAdmins === 0
  }

  private parseBootstrapIds(): Set<string> {
    const raw = this.configService.get<string>("BOOTSTRAP_ADMIN_CLERK_USER_IDS") ?? ""
    const ids = new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    )
    if (ids.size === 0 && raw.length > 0) {
      this.logger.warn("BOOTSTRAP_ADMIN_CLERK_USER_IDS is set but parsed to empty — check for whitespace-only values")
    }
    return ids
  }
}
