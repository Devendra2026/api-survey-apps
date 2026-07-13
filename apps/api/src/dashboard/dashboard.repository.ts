import { Injectable } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildTenantWhere, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(user: AuthenticatedUser) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const where: Prisma.SurveyWhereInput = {
      deletedAt: null,
      ...(tenantWhere ?? {}),
    }

    const [total, byStatus, recent] = await Promise.all([
      this.prisma.db.survey.count({ where }),
      this.prisma.db.survey.groupBy({
        by: ["surveyStatus"],
        where,
        _count: { _all: true },
      }),
      this.prisma.db.survey.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          propertyId: true,
          surveyStatus: true,
          createdAt: true,
          submittedAt: true,
        },
      }),
    ])

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.surveyStatus, r._count._all])),
      recent,
    }
  }
}
