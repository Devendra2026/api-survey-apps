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

    const [
      total,
      byStatus,
      byQcStatus,
      recent,
      todayCreated,
      todaySubmitted,
      todayApproved,
      gpsAccuracy,
      districtRows,
      ulbRows,
      wardRows,
      trendRows,
      topSurveyorRows,
      importJobs,
      exportJobs,
    ] = await Promise.all([
      this.prisma.db.survey.count({ where }),
      this.prisma.db.survey.groupBy({
        by: ["surveyStatus"],
        where,
        _count: { _all: true },
      }),
      this.prisma.db.survey.groupBy({
        by: ["qcStatus"],
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
      this.prisma.db.survey.aggregate({
        where,
        _avg: { gpsAccuracyMeters: true },
      }),
      this.prisma.db.survey.groupBy({
        by: ["districtId"],
        where,
        _count: { _all: true },
        orderBy: { _count: { districtId: "desc" } },
        take: 8,
      }),
      this.prisma.db.survey.groupBy({
        by: ["ulbId"],
        where,
        _count: { _all: true },
        orderBy: { _count: { ulbId: "desc" } },
        take: 8,
      }),
      this.prisma.db.survey.groupBy({
        by: ["wardId", "surveyStatus"],
        where,
        _count: { _all: true },
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
      this.prisma.db.importJob.findMany({
        where: { createdById: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, status: true, originalName: true, processedRows: true, totalRows: true, createdAt: true },
      }),
      this.prisma.db.exportJob.findMany({
        where: { createdById: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, status: true, reportType: true, format: true, rowCount: true, createdAt: true },
      }),
    ])

    const statusMap = Object.fromEntries(byStatus.map((r) => [r.surveyStatus, r._count._all]))
    const qcStatusMap = Object.fromEntries(byQcStatus.map((r) => [r.qcStatus, r._count._all]))
    const wards = this.toWardCounts(wardRows).slice(0, 8)
    const [districts, ulbs, wardDetails] = await Promise.all([
      this.prisma.db.district.findMany({
        where: { id: { in: districtRows.map((row) => row.districtId) } },
        select: { id: true, name: true },
      }),
      this.prisma.db.ulb.findMany({
        where: { id: { in: ulbRows.map((row) => row.ulbId) } },
        select: { id: true, name: true },
      }),
      this.prisma.db.ward.findMany({
        where: { id: { in: wards.map((ward) => ward.id) } },
        select: { id: true, wardName: true, wardNumber: true },
      }),
    ])
    const districtNames = new Map(districts.map((district) => [district.id, district.name]))
    const ulbNames = new Map(ulbs.map((ulb) => [ulb.id, ulb.name]))
    const wardNames = new Map(wardDetails.map((ward) => [ward.id, ward.wardName || `Ward ${ward.wardNumber}`]))
    const byDistrict = districtRows.map((row) => ({
      id: row.districtId,
      name: districtNames.get(row.districtId) ?? "Unknown district",
      count: row._count._all,
    }))
    const byUlb = ulbRows.map((row) => ({
      id: row.ulbId,
      name: ulbNames.get(row.ulbId) ?? "Unknown ULB",
      count: row._count._all,
    }))
    const byWard = wards.map((ward) => ({
      ...ward,
      name: wardNames.get(ward.id) ?? "Unknown ward",
    }))

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
      qcStatus: qcStatusMap,
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
      gps: {
        averageAccuracyMeters: gpsAccuracy._avg.gpsAccuracyMeters?.toNumber() ?? null,
      },
      jobs: {
        imports: importJobs,
        exports: exportJobs,
      },
    }
  }

  private toWardCounts(
    rows: Array<{ wardId: string; surveyStatus: string; _count: { _all: number } }>
  ): Array<{ id: string; count: number; byStatus: Record<string, number> }> {
    const wards = new Map<string, { id: string; count: number; byStatus: Record<string, number> }>()
    for (const row of rows) {
      const ward = wards.get(row.wardId) ?? { id: row.wardId, count: 0, byStatus: {} }
      ward.count += row._count._all
      ward.byStatus[row.surveyStatus] = row._count._all
      wards.set(row.wardId, ward)
    }
    return [...wards.values()].sort((a, b) => b.count - a.count)
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
