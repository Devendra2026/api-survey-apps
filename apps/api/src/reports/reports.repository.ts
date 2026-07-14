import { Injectable } from "@nestjs/common"
import type { Prisma, SurveyStatus } from "@workspace/database"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { buildTenantWhere, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { ExportFilters } from "./export.types.js"

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async surveyReport(
    user: AuthenticatedUser,
    query: PaginationQueryDto & { surveyStatus?: SurveyStatus; ulbId?: string }
  ) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const { skip, take, page, limit } = getSkipTake(query)

    const where: Prisma.SurveyWhereInput = {
      deletedAt: null,
      AND: [
        tenantWhere ?? {},
        query.surveyStatus ? { surveyStatus: query.surveyStatus } : {},
        query.ulbId ? { ulbId: query.ulbId } : {},
        query.search
          ? {
              OR: [
                { propertyId: { contains: query.search, mode: "insensitive" } },
                { respondentName: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    }

    const [items, total] = await Promise.all([
      this.prisma.db.survey.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "submittedAt", "surveyStatus"]),
        select: {
          id: true,
          propertyId: true,
          surveyStatus: true,
          stateId: true,
          districtId: true,
          ulbId: true,
          wardId: true,
          respondentName: true,
          mobileNumber: true,
          totalBuiltAreaSqFt: true,
          submittedAt: true,
          approvedAt: true,
          rejectedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.db.survey.count({ where }),
    ])

    return toPaginatedResult(items, total, page, limit)
  }

  async exportSurveys(user: AuthenticatedUser, filters: ExportFilters, take = 10000) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)

    const dateFilter: Prisma.SurveyWhereInput = {}
    if (filters.dateFrom || filters.dateTo) {
      dateFilter.createdAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      }
    }

    return this.prisma.db.survey.findMany({
      where: {
        deletedAt: null,
        ...(tenantWhere ?? {}),
        ...(filters.surveyStatus ? { surveyStatus: filters.surveyStatus } : {}),
        ...(filters.stateId ? { stateId: filters.stateId } : {}),
        ...(filters.districtId ? { districtId: filters.districtId } : {}),
        ...(filters.ulbId ? { ulbId: filters.ulbId } : {}),
        ...(filters.wardId ? { wardId: filters.wardId } : {}),
        ...dateFilter,
        ...(filters.search
          ? {
              OR: [
                { propertyId: { contains: filters.search, mode: "insensitive" } },
                { respondentName: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        propertyId: true,
        surveyStatus: true,
        stateId: true,
        districtId: true,
        ulbId: true,
        wardId: true,
        respondentName: true,
        mobileNumber: true,
        totalBuiltAreaSqFt: true,
        submittedAt: true,
        approvedAt: true,
        createdAt: true,
      },
    })
  }
}
