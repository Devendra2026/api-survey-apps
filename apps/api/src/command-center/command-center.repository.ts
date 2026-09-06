import { Injectable } from "@nestjs/common"
import type { Prisma, QcStatus, SurveyStatus } from "@workspace/database"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { WardCatalogService } from "../common/services/ward-catalog.service.js"
import {
  addSurveyRowToBuckets,
  emptyBucketTotals,
  percentOf,
  tallySurveyBuckets,
  type SurveyBucketTotals,
} from "../common/utils/survey-bucket.util.js"
import { buildTenantWhere, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { resolveWardIdAliases } from "../common/utils/ward-survey-alias.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CommandCenterFiltersDto } from "./dto/command-center-filters.dto.js"

const SURVEY_STATUSES = new Set(["DRAFT", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED", "REOPENED"])

const QC_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"])

@Injectable()
export class CommandCenterRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wardCatalog: WardCatalogService
  ) {}

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

    const [statusMatrix, submittedToday, editedToday] = await Promise.all([
      this.prisma.db.survey.groupBy({
        by: ["surveyStatus", "qcStatus"],
        where,
        _count: { _all: true },
      }),
      this.prisma.db.survey.count({
        where: { ...where, submittedAt: { gte: startOfToday } },
      }),
      this.prisma.db.survey.count({
        where: {
          ...where,
          surveyStatus: { in: ["DRAFT", "IN_PROGRESS", "REOPENED"] },
          updatedAt: { gte: startOfToday },
        },
      }),
    ])

    const buckets = tallySurveyBuckets(statusMatrix)

    // Cards partition the total: drafts (incl. rework) + submitted + approved + returned.
    const draftSurveys = buckets.fieldDraft + buckets.rework
    const submittedSurveys = buckets.pendingQc
    const qcApproved = buckets.approved
    const fieldCompleted = buckets.pendingQc + buckets.approved

    return {
      totalProperties: buckets.total,
      draftSurveys,
      submittedSurveys,
      qcApproved,
      approvedCompleted: qcApproved,
      avgFieldCompletionPct: percentOf(fieldCompleted, buckets.total),
      submittedToday,
      editedToday,
      awaitingQc: submittedSurveys,
      returned: buckets.returned,
    }
  }

  async getWards(user: AuthenticatedUser, filters: CommandCenterFiltersDto) {
    const f = this.resolveFilters(filters)
    // Require municipality (ULB) for populated ward grid — empty state otherwise
    if (!f.ulbId) return []

    const wards = await this.wardCatalog.listScopedWards(user, f.ulbId)
    if (wards.length === 0) return []

    const where = this.buildWhere(user, filters)
    const aliasToActive = await resolveWardIdAliases(this.prisma, f.ulbId, wards)
    const activeIdSet = new Set(wards.map((w) => w.id))

    // Do not restrict to active ward IDs: after Align, surveys often still point at
    // soft-deleted ward rows. ULB KPIs count them; cards must too (via aliases).
    const [statusRows, surveyorRows] = await Promise.all([
      this.prisma.db.survey.groupBy({
        by: ["wardId", "surveyStatus", "qcStatus"],
        where,
        _count: { _all: true },
      }),
      this.prisma.db.survey.groupBy({
        by: ["wardId", "createdById"],
        where,
        _count: { _all: true },
      }),
    ])

    const bucketsByWard = new Map<string, SurveyBucketTotals>()
    const surveyorsByWard = new Map<string, Set<string>>()
    for (const ward of wards) {
      bucketsByWard.set(ward.id, emptyBucketTotals())
      surveyorsByWard.set(ward.id, new Set<string>())
    }

    const resolveActiveId = (wardId: string | null): string | null => {
      if (!wardId) return null
      if (activeIdSet.has(wardId)) return wardId
      return aliasToActive.get(wardId) ?? null
    }

    for (const row of statusRows) {
      const activeId = resolveActiveId(row.wardId)
      if (!activeId) continue
      const current = bucketsByWard.get(activeId)
      if (!current) continue
      addSurveyRowToBuckets(current, row)
    }

    for (const row of surveyorRows) {
      const activeId = resolveActiveId(row.wardId)
      if (!activeId) continue
      surveyorsByWard.get(activeId)?.add(row.createdById)
    }

    const mapped = wards.map((ward) => {
      const buckets = bucketsByWard.get(ward.id) ?? emptyBucketTotals()
      const label = ward.wardName?.trim() ?? ""
      return {
        wardId: ward.id,
        wardName: label,
        wardNumber: ward.wardNumber,
        totalProperties: buckets.total,
        draft: buckets.fieldDraft + buckets.rework,
        submitted: buckets.pendingQc,
        qcApproved: buckets.approved,
        completed: buckets.approved,
        returned: buckets.returned,
        activeSurveyors: surveyorsByWard.get(ward.id)?.size ?? 0,
      }
    })

    // When a specific ward is selected, return only that card (avoid zero-filled siblings).
    if (f.wardId) {
      return mapped.filter((ward) => ward.wardId === f.wardId)
    }

    return mapped
  }
}
