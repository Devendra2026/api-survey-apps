import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PrismaService } from "../../prisma/prisma.service.js"

/**
 * Bootstraps the first real ADMIN when a Clerk user has no tenant roles
 * and their clerkUserId is listed in BOOTSTRAP_ADMIN_CLERK_USER_IDS.
 * Otherwise assigns PENDING_APPROVAL so new signups wait for Admin approval.
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
    if (!bootstrapIds.has(clerkUserId)) {
      return false
    }

    const existing = await this.prisma.db.userTenantRole.findFirst({
      where: { userId, isActive: true },
      select: { id: true },
    })
    if (existing) {
      return false
    }

    const adminRole = await this.prisma.db.role.findUnique({
      where: { name: "ADMIN" },
      select: { id: true },
    })
    if (!adminRole) {
      this.logger.error("ADMIN role not found — run db seed before using bootstrap")
      return false
    }

    await this.prisma.db.userTenantRole.create({
      data: {
        userId,
        roleId: adminRole.id,
        assignedBy: userId,
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    })

    this.logger.log(`Bootstrapped ADMIN for clerkUserId=${clerkUserId}`)
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

  private parseBootstrapIds(): Set<string> {
    const raw = this.configService.get<string>("BOOTSTRAP_ADMIN_CLERK_USER_IDS") ?? ""
    return new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    )
  }
}
