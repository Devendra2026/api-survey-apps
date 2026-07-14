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

    const now = new Date()
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const monthsBack = 11
    const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1))

    const [total, byStatus, recent, todayCreated, todaySubmitted, todayApproved, geoRows, trendRows, topSurveyorRows] =
      await Promise.all([
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
        this.prisma.db.survey.count({
          where: { ...where, createdAt: { gte: startOfToday } },
        }),
        this.prisma.db.survey.count({
          where: { ...where, submittedAt: { gte: startOfToday } },
        }),
        this.prisma.db.survey.count({
          where: { ...where, approvedAt: { gte: startOfToday } },
        }),
        this.prisma.db.survey.findMany({
          where,
          select: {
            districtId: true,
            ulbId: true,
            wardId: true,
            district: { select: { id: true, name: true } },
            ulb: { select: { id: true, name: true } },
            ward: { select: { id: true, wardName: true, wardNumber: true } },
          },
          take: 5000,
        }),
        this.prisma.db.survey.findMany({
          where: { ...where, createdAt: { gte: trendStart } },
          select: { createdAt: true },
          take: 10000,
        }),
        this.prisma.db.survey.groupBy({
          by: ["createdById"],
          where,
          _count: { _all: true },
          orderBy: { _count: { createdById: "desc" } },
          take: 5,
        }),
      ])

    const statusMap = Object.fromEntries(byStatus.map((r) => [r.surveyStatus, r._count._all]))

    const byDistrict = this.topCounts(
      geoRows.map((r) => ({ id: r.district.id, name: r.district.name })),
      8
    )
    const byUlb = this.topCounts(
      geoRows.map((r) => ({ id: r.ulb.id, name: r.ulb.name })),
      8
    )
    const byWard = this.topCounts(
      geoRows.map((r) => ({
        id: r.ward.id,
        name: r.ward.wardName || `Ward ${r.ward.wardNumber}`,
      })),
      8
    )

    const monthlyTrend = this.buildMonthlyTrend(trendRows, monthsBack + 1)

    const surveyorIds = topSurveyorRows.map((r) => r.createdById)
    const surveyors = surveyorIds.length
      ? await this.prisma.db.user.findMany({
          where: { id: { in: surveyorIds } },
          select: { id: true, fullName: true, email: true },
        })
      : []
    const surveyorMap = new Map(surveyors.map((u) => [u.id, u]))
    const topSurveyors = topSurveyorRows.map((r) => ({
      id: r.createdById,
      fullName: surveyorMap.get(r.createdById)?.fullName ?? "Unknown",
      email: surveyorMap.get(r.createdById)?.email ?? "",
      count: r._count._all,
    }))

    return {
      total,
      byStatus: statusMap,
      recent,
      today: {
        created: todayCreated,
        submitted: todaySubmitted,
        approved: todayApproved,
      },
      pendingApproval: statusMap.SUBMITTED ?? 0,
      rejected: statusMap.REJECTED ?? 0,
      byDistrict,
      byUlb,
      byWard,
      monthlyTrend,
      topSurveyors,
    }
  }

  private topCounts(
    items: Array<{ id: string; name: string }>,
    limit: number
  ): Array<{ id: string; name: string; count: number }> {
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const item of items) {
      const existing = map.get(item.id)
      if (existing) existing.count += 1
      else map.set(item.id, { id: item.id, name: item.name, count: 1 })
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit)
  }

  private buildMonthlyTrend(rows: Array<{ createdAt: Date }>, months: number): Array<{ month: string; count: number }> {
    const now = new Date()
    const buckets: Array<{ key: string; month: string; count: number }> = []

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
      buckets.push({ key, month: label, count: 0 })
    }

    const index = new Map(buckets.map((b) => [b.key, b]))
    for (const row of rows) {
      const d = row.createdAt
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
      const bucket = index.get(key)
      if (bucket) bucket.count += 1
    }

    return buckets.map(({ month, count }) => ({ month, count }))
  }
}
