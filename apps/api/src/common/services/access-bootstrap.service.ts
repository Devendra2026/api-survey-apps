import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { seedPermissionsAndRoles } from "@workspace/database"
import { PrismaService } from "../../prisma/prisma.service.js"

/**
 * On API boot: ensure RBAC catalog exists.
 * Admin promotion happens on login (RoleProvisioningService) so the signed-in
 * Clerk user is the one who receives ADMIN — not a ghost row from env alone.
 */
@Injectable()
export class AccessBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AccessBootstrapService.name)

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const adminBefore = await this.prisma.db.role.findUnique({
      where: { name: "ADMIN" },
      select: { id: true, _count: { select: { permissions: true } } },
    })
    const wasMissing = !adminBefore || adminBefore._count.permissions === 0

    await seedPermissionsAndRoles(this.prisma.db)

    if (wasMissing) {
      this.logger.log("RBAC catalog was missing — seeded permissions and roles on startup")
    } else {
      this.logger.log("RBAC catalog verified on startup")
    }
  }
}
