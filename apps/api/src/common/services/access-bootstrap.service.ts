import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { seedPermissionsAndRoles, seedReferenceCatalogs } from "@workspace/database"
import { PrismaService } from "../../prisma/prisma.service.js"

/**
 * On API boot: ensure RBAC + reference catalogs exist (idempotent upserts).
 * Admin promotion happens on login (RoleProvisioningService).
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
    const wasMissingRbac = !adminBefore || adminBefore._count.permissions === 0

    const referenceCountBefore = await this.prisma.db.referenceCategory.count()

    await seedPermissionsAndRoles(this.prisma.db)
    await seedReferenceCatalogs(this.prisma.db)

    if (wasMissingRbac) {
      this.logger.log("RBAC catalog was missing — seeded permissions and roles on startup")
    } else {
      this.logger.log("RBAC catalog verified on startup")
    }

    const referenceCountAfter = await this.prisma.db.referenceCategory.count()
    if (referenceCountBefore === 0) {
      this.logger.log(`Reference catalogs were missing — seeded ${referenceCountAfter} categories on startup`)
    } else {
      this.logger.log(`Reference catalogs verified on startup (${referenceCountAfter} categories)`)
    }
  }
}
