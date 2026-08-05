import { Injectable } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { tallySurveyBuckets } from "../common/utils/survey-bucket.util.js"
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
      statusMatrix,
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
      this.prisma.db.survey.groupBy({
        by: ["surveyStatus", "qcStatus"],
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
    const buckets = tallySurveyBuckets(statusMatrix)
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
      buckets,
      recent,
      today: {
        created: todayCreated,
        submitted: todaySubmitted,
        approved: todayApproved,
      },
      pendingApproval: buckets.pendingQc,
      rejected: buckets.returned,
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

  async getOrganization(user: AuthenticatedUser) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const surveyWhere: Prisma.SurveyWhereInput = {
      deletedAt: null,
      ...(tenantWhere ?? {}),
    }

    const [surveyorRole, qcRole] = await Promise.all([
      this.prisma.db.role.findFirst({ where: { name: "SURVEYOR" }, select: { id: true } }),
      this.prisma.db.role.findFirst({ where: { name: "QC_SUPERVISOR" }, select: { id: true } }),
    ])

    const activeRoleWhere = (roleId: string | undefined): Prisma.UserTenantRoleWhereInput => ({
      roleId: roleId ?? "__none__",
      isActive: true,
      deactivatedAt: null,
      user: { isActive: true },
    })

    const [activeSurveyors, activeQcSupervisors, districtRows, ulbRows] = await Promise.all([
      surveyorRole
        ? this.prisma.db.userTenantRole.count({ where: activeRoleWhere(surveyorRole.id) })
        : Promise.resolve(0),
      qcRole ? this.prisma.db.userTenantRole.count({ where: activeRoleWhere(qcRole.id) }) : Promise.resolve(0),
      this.prisma.db.survey.groupBy({
        by: ["districtId"],
        where: surveyWhere,
        _count: { _all: true },
      }),
      this.prisma.db.survey.groupBy({
        by: ["ulbId"],
        where: surveyWhere,
        _count: { _all: true },
      }),
    ])

    return {
      activeSurveyors,
      activeQcSupervisors,
      districts: districtRows.length,
      municipalities: ulbRows.length,
    }
  }

  async getAnalytics(user: AuthenticatedUser) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const where: Prisma.SurveyWhereInput = {
      deletedAt: null,
      ...(tenantWhere ?? {}),
    }

    const now = new Date()
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29))

    const [
      createdRows,
      approvedRows,
      rejectedRows,
      submittedByCreator,
      approvedByCreator,
      ulbRows,
      auditRows,
      activityRows,
    ] = await Promise.all([
      this.prisma.db.survey.findMany({
        where: { ...where, createdAt: { gte: start } },
        select: { createdAt: true },
        take: 20000,
      }),
      this.prisma.db.survey.findMany({
        where: { ...where, approvedAt: { gte: start } },
        select: { approvedAt: true },
        take: 20000,
      }),
      this.prisma.db.survey.findMany({
        where: { ...where, rejectedAt: { gte: start } },
        select: { rejectedAt: true },
        take: 20000,
      }),
      this.prisma.db.survey.groupBy({
        by: ["createdById"],
        where: {
          ...where,
          surveyStatus: { in: ["SUBMITTED", "APPROVED", "REJECTED", "REOPENED"] },
        },
        _count: { _all: true },
        orderBy: { _count: { createdById: "desc" } },
        take: 8,
      }),
      this.prisma.db.survey.groupBy({
        by: ["createdById"],
        where: { ...where, qcStatus: "APPROVED" },
        _count: { _all: true },
      }),
      this.prisma.db.survey.groupBy({
        by: ["ulbId", "qcStatus"],
        where,
        _count: { _all: true },
      }),
      this.prisma.db.surveyAudit.groupBy({
        by: ["changedBy", "action"],
        where: {
          action: { in: ["APPROVED", "REJECTED"] },
          survey: where,
        },
        _count: { _all: true },
      }),
      this.prisma.db.surveyAudit.findMany({
        where: {
          action: "SUBMITTED",
          survey: where,
        },
        orderBy: { changedAt: "desc" },
        take: 6,
        select: {
          id: true,
          changedAt: true,
          changer: { select: { fullName: true, email: true } },
          survey: { select: { propertyId: true } },
        },
      }),
    ])

    const dailyTrend = this.buildDailyTrend(start, now, createdRows, approvedRows, rejectedRows)

    const approvedMap = new Map(approvedByCreator.map((r) => [r.createdById, r._count._all]))
    const creatorIds = submittedByCreator.map((r) => r.createdById)
    const creators = creatorIds.length
      ? await this.prisma.db.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, fullName: true, email: true },
        })
      : []
    const creatorName = new Map(creators.map((u) => [u.id, u.fullName || u.email]))

    const surveyorProductivity = submittedByCreator.map((row) => ({
      name: creatorName.get(row.createdById) ?? "Unknown",
      submitted: row._count._all,
      approved: approvedMap.get(row.createdById) ?? 0,
    }))

    const ulbIds = [...new Set(ulbRows.map((r) => r.ulbId))]
    const ulbs = ulbIds.length
      ? await this.prisma.db.ulb.findMany({
          where: { id: { in: ulbIds } },
          select: { id: true, name: true },
        })
      : []
    const ulbNames = new Map(ulbs.map((u) => [u.id, u.name]))
    const ulbAgg = new Map<string, { approved: number; total: number }>()
    for (const row of ulbRows) {
      const current = ulbAgg.get(row.ulbId) ?? { approved: 0, total: 0 }
      current.total += row._count._all
      if (row.qcStatus === "APPROVED") current.approved += row._count._all
      ulbAgg.set(row.ulbId, current)
    }
    const municipalities = [...ulbAgg.entries()]
      .map(([id, stats]) => {
        const percent = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0
        return {
          name: ulbNames.get(id) ?? "Unknown ULB",
          approved: stats.approved,
          target: stats.total,
          percent,
          accent: percent === 0 ? "muted" : percent >= 30 ? "amber" : "slate",
        }
      })
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 8)

    const supervisorMap = new Map<string, { approved: number; rejected: number }>()
    for (const row of auditRows) {
      const current = supervisorMap.get(row.changedBy) ?? { approved: 0, rejected: 0 }
      if (row.action === "APPROVED") current.approved += row._count._all
      if (row.action === "REJECTED") current.rejected += row._count._all
      supervisorMap.set(row.changedBy, current)
    }
    const supervisorIds = [...supervisorMap.keys()]
    const supervisors = supervisorIds.length
      ? await this.prisma.db.user.findMany({
          where: { id: { in: supervisorIds } },
          select: { id: true, fullName: true, email: true },
        })
      : []
    const supervisorNames = new Map(supervisors.map((u) => [u.id, u.fullName || u.email]))
    const qcSupervisors = [...supervisorMap.entries()]
      .map(([id, stats]) => ({
        name: supervisorNames.get(id) ?? "Unknown",
        approved: stats.approved,
        rejected: stats.rejected,
        status: stats.approved >= 100 ? ("High Throughput" as const) : undefined,
      }))
      .sort((a, b) => b.approved - a.approved)
      .slice(0, 8)

    // If no QC audits yet, still list active QC supervisors as zero rows
    if (qcSupervisors.length === 0) {
      const qcRole = await this.prisma.db.role.findFirst({ where: { name: "QC_SUPERVISOR" }, select: { id: true } })
      if (qcRole) {
        const qcUsers = await this.prisma.db.userTenantRole.findMany({
          where: { roleId: qcRole.id, isActive: true, deactivatedAt: null, user: { isActive: true } },
          take: 5,
          select: { user: { select: { fullName: true, email: true } } },
        })
        for (const row of qcUsers) {
          qcSupervisors.push({
            name: row.user.fullName || row.user.email,
            approved: 0,
            rejected: 0,
            status: undefined,
          })
        }
      }
    }

    const recentActivity = activityRows.map((row) => ({
      id: row.id,
      title: `${row.survey.propertyId} submitted for QC`,
      actor: row.changer.fullName || row.changer.email,
      timestamp: row.changedAt.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    }))

    return {
      dailyTrend,
      surveyorProductivity,
      qcSupervisors,
      municipalities,
      recentActivity,
    }
  }

  private buildDailyTrend(
    start: Date,
    end: Date,
    createdRows: Array<{ createdAt: Date }>,
    approvedRows: Array<{ approvedAt: Date | null }>,
    rejectedRows: Array<{ rejectedAt: Date | null }>
  ): Array<{ date: string; created: number; approved: number; rejected: number }> {
    const buckets: Array<{ key: string; date: string; created: number; approved: number; rejected: number }> = []
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
    const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))

    while (cursor <= endDay) {
      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`
      const date = `${String(cursor.getUTCMonth() + 1).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`
      buckets.push({ key, date, created: 0, approved: 0, rejected: 0 })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    const index = new Map(buckets.map((b) => [b.key, b]))
    const dayKey = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`

    for (const row of createdRows) {
      const bucket = index.get(dayKey(row.createdAt))
      if (bucket) bucket.created += 1
    }
    for (const row of approvedRows) {
      if (!row.approvedAt) continue
      const bucket = index.get(dayKey(row.approvedAt))
      if (bucket) bucket.approved += 1
    }
    for (const row of rejectedRows) {
      if (!row.rejectedAt) continue
      const bucket = index.get(dayKey(row.rejectedAt))
      if (bucket) bucket.rejected += 1
    }

    return buckets.map(({ date, created, approved, rejected }) => ({ date, created, approved, rejected }))
  }
}
