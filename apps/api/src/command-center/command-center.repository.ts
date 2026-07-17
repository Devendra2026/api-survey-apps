import { Injectable } from "@nestjs/common"
import type { Prisma, QcStatus, SurveyStatus } from "@workspace/database"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildTenantWhere, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CommandCenterFiltersDto } from "./dto/command-center-filters.dto.js"

const SURVEY_STATUSES = new Set(["DRAFT", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED", "REOPENED"])

const QC_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "RETURNED"])

@Injectable()
export class CommandCenterRepository {
  constructor(private readonly prisma: PrismaService) {}

  private resolveFilters(filters: CommandCenterFiltersDto) {
    const districtId = filters.districtId || filters.district
    const ulbId = filters.ulbId || filters.ulb
    const wardId = filters.wardId || filters.ward
    const surveyStatus =
      filters.surveyStatus && filters.surveyStatus !== "any" && SURVEY_STATUSES.has(filters.surveyStatus)
        ? (filters.surveyStatus as SurveyStatus)
        : undefined
    const qcStatus =
      filters.qcStatus && filters.qcStatus !== "any" && QC_STATUSES.has(filters.qcStatus)
        ? (filters.qcStatus as QcStatus)
        : undefined

    let dateFrom: Date | undefined
    let dateTo: Date | undefined

    if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
      const year = Number(filters.month.slice(0, 4))
      const month = Number(filters.month.slice(5, 7))
      dateFrom = new Date(Date.UTC(year, month - 1, 1))
      dateTo = new Date(Date.UTC(year, month, 1))
    } else {
      if (filters.dateFrom) dateFrom = new Date(`${filters.dateFrom}T00:00:00.000Z`)
      if (filters.dateTo) {
        dateTo = new Date(`${filters.dateTo}T00:00:00.000Z`)
        dateTo.setUTCDate(dateTo.getUTCDate() + 1)
      }
    }

    return { districtId, ulbId, wardId, surveyStatus, qcStatus, dateFrom, dateTo }
  }

  private buildWhere(user: AuthenticatedUser, filters: CommandCenterFiltersDto): Prisma.SurveyWhereInput {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const f = this.resolveFilters(filters)

    return {
      deletedAt: null,
      ...(tenantWhere ?? {}),
      ...(f.districtId ? { districtId: f.districtId } : {}),
      ...(f.ulbId ? { ulbId: f.ulbId } : {}),
      ...(f.wardId ? { wardId: f.wardId } : {}),
      ...(f.surveyStatus ? { surveyStatus: f.surveyStatus } : {}),
      ...(f.qcStatus ? { qcStatus: f.qcStatus } : {}),
      ...(f.dateFrom || f.dateTo
        ? {
            createdAt: {
              ...(f.dateFrom ? { gte: f.dateFrom } : {}),
              ...(f.dateTo ? { lt: f.dateTo } : {}),
            },
          }
        : {}),
    }
  }

  async getKpis(user: AuthenticatedUser, filters: CommandCenterFiltersDto) {
    const where = this.buildWhere(user, filters)
    const now = new Date()
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

    const [totalProperties, byStatus, byQc, submittedToday, editedToday, returned] = await Promise.all([
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
      this.prisma.db.survey.count({
        where: { ...where, submittedAt: { gte: startOfToday } },
      }),
      this.prisma.db.survey.count({
        where: {
          ...where,
          surveyStatus: "DRAFT",
          updatedAt: { gte: startOfToday },
        },
      }),
      this.prisma.db.survey.count({
        where: { ...where, surveyStatus: "REJECTED" },
      }),
    ])

    const statusMap = Object.fromEntries(byStatus.map((r) => [r.surveyStatus, r._count._all]))
    const qcMap = Object.fromEntries(byQc.map((r) => [r.qcStatus, r._count._all]))

    const draftSurveys = statusMap.DRAFT ?? 0
    const submittedSurveys = statusMap.SUBMITTED ?? 0
    const qcApproved = (statusMap.APPROVED ?? 0) || (qcMap.APPROVED ?? 0)
    const awaitingQc = submittedSurveys
    const avgFieldCompletionPct =
      totalProperties > 0 ? Math.round(((qcApproved + submittedSurveys) / totalProperties) * 100) : 0

    return {
      totalProperties,
      draftSurveys,
      submittedSurveys,
      qcApproved,
      approvedCompleted: qcApproved,
      avgFieldCompletionPct,
      submittedToday,
      editedToday,
      awaitingQc,
      returned,
    }
  }

  async getWards(user: AuthenticatedUser, filters: CommandCenterFiltersDto) {
    const f = this.resolveFilters(filters)
    // Require municipality (ULB) for populated ward grid — empty state otherwise
    if (!f.ulbId) return []

    const where = this.buildWhere(user, filters)

    const [statusRows, surveyorRows] = await Promise.all([
      this.prisma.db.survey.groupBy({
        by: ["wardId", "surveyStatus"],
        where,
        _count: { _all: true },
      }),
      this.prisma.db.survey.groupBy({
        by: ["wardId", "createdById"],
        where,
        _count: { _all: true },
      }),
    ])

    const byWard = new Map<
      string,
      { totalProperties: number; draft: number; submitted: number; qcApproved: number; surveyorIds: Set<string> }
    >()

    for (const row of statusRows) {
      const current = byWard.get(row.wardId) ?? {
        totalProperties: 0,
        draft: 0,
        submitted: 0,
        qcApproved: 0,
        surveyorIds: new Set<string>(),
      }
      current.totalProperties += row._count._all
      if (row.surveyStatus === "DRAFT") current.draft += row._count._all
      if (row.surveyStatus === "SUBMITTED") current.submitted += row._count._all
      if (row.surveyStatus === "APPROVED") current.qcApproved += row._count._all
      byWard.set(row.wardId, current)
    }

    for (const row of surveyorRows) {
      const current = byWard.get(row.wardId)
      if (!current) continue
      current.surveyorIds.add(row.createdById)
    }

    if (byWard.size === 0) return []

    const wards = await this.prisma.db.ward.findMany({
      where: { id: { in: [...byWard.keys()] } },
      select: { id: true, wardName: true, wardNumber: true },
      orderBy: { wardNumber: "asc" },
    })

    return wards.map((ward) => {
      const stats = byWard.get(ward.id)!
      const label = ward.wardName?.trim() || `Ward ${ward.wardNumber}`
      return {
        wardId: ward.id,
        wardName: label.startsWith("Ward") ? label : `Ward ${ward.wardNumber}`,
        wardNumber: ward.wardNumber,
        totalProperties: stats.totalProperties,
        draft: stats.draft,
        submitted: stats.submitted,
        qcApproved: stats.qcApproved,
        completed: stats.qcApproved,
        activeSurveyors: stats.surveyorIds.size,
      }
    })
  }
}
