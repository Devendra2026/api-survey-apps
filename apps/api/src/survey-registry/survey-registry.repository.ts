import { Injectable } from "@nestjs/common"
import type { Prisma, SurveyStatus } from "@workspace/database"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { parcelNumberVariants } from "../common/utils/parcel-search.util.js"
import { buildTenantWhere, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { SurveyRegistryQueryDto } from "./dto/survey-registry.dto.js"

const EDITABLE: SurveyStatus[] = ["DRAFT", "IN_PROGRESS", "REOPENED"]

function formatSurveyDate(value: Date | null | undefined) {
  if (!value) return "—"
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function displayStatus(surveyStatus: string, qcStatus?: string | null) {
  if (surveyStatus === "APPROVED" || qcStatus === "APPROVED") return "Approved"
  if (surveyStatus === "REJECTED" || qcStatus === "REJECTED") return "Rejected"
  if (surveyStatus === "SUBMITTED") return "Submitted"
  if (surveyStatus === "DRAFT" || surveyStatus === "IN_PROGRESS" || surveyStatus === "REOPENED") return "Draft"
  return surveyStatus
}

function progressFor(surveyStatus: string, completionPct: number | null | undefined) {
  if (typeof completionPct === "number" && completionPct >= 0) return Math.min(100, completionPct)
  switch (surveyStatus) {
    case "APPROVED":
      return 100
    case "SUBMITTED":
      return 90
    case "IN_PROGRESS":
      return 55
    case "REJECTED":
      return 70
    case "REOPENED":
      return 40
    default:
      return 15
  }
}

@Injectable()
export class SurveyRegistryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Field-scoped registry search: owner / parcel / propertyId / all (three-field OR). */
  private registrySearchOr(search: string, searchField?: string): Prisma.SurveyWhereInput[] {
    const contains = { contains: search, mode: "insensitive" as const }
    const propertyIdClause: Prisma.SurveyWhereInput = { propertyId: contains }
    const ownerClauses: Prisma.SurveyWhereInput[] = [
      { respondentName: contains },
      { coOwners: { some: { name: contains } } },
    ]
    const parcelVariants = parcelNumberVariants(search)
    const parcelClauses: Prisma.SurveyWhereInput[] = [
      { parcelNumber: contains },
      ...(parcelVariants.length ? [{ parcelNumber: { in: parcelVariants } }] : []),
    ]

    switch (searchField) {
      case "propertyId":
        return [propertyIdClause]
      case "owner":
        return ownerClauses
      case "parcel":
        return parcelClauses
      case "all":
      default:
        return [propertyIdClause, ...ownerClauses, ...parcelClauses]
    }
  }

  private baseWhere(
    user: AuthenticatedUser,
    filters: Pick<SurveyRegistryQueryDto, "districtId" | "ulbId" | "wardId" | "surveyorId" | "search" | "searchField">
  ): Prisma.SurveyWhereInput {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const search = filters.search?.trim()

    return {
      deletedAt: null,
      ...(tenantWhere ?? {}),
      ...(filters.districtId ? { districtId: filters.districtId } : {}),
      ...(filters.ulbId ? { ulbId: filters.ulbId } : {}),
      ...(filters.wardId ? { wardId: filters.wardId } : {}),
      ...(filters.surveyorId ? { assignedToId: filters.surveyorId } : {}),
      ...(search
        ? {
            OR: this.registrySearchOr(search, filters.searchField),
          }
        : {}),
    }
  }

  private tabWhere(tab?: string): Prisma.SurveyWhereInput {
    switch (tab) {
      case "draft":
        return { surveyStatus: { in: ["DRAFT", "IN_PROGRESS", "REOPENED"] } }
      case "submitted":
        return { surveyStatus: "SUBMITTED" }
      case "qcPending":
        return { surveyStatus: "SUBMITTED", qcStatus: "PENDING" }
      case "qcApproved":
        return {
          OR: [{ surveyStatus: "APPROVED" }, { qcStatus: "APPROVED" }],
        }
      case "rejected":
        return {
          OR: [{ surveyStatus: "REJECTED" }, { qcStatus: "REJECTED" }],
        }
      default:
        return {}
    }
  }

  async getCounts(
    user: AuthenticatedUser,
    filters: Pick<SurveyRegistryQueryDto, "districtId" | "ulbId" | "wardId" | "surveyorId" | "search" | "searchField">
  ) {
    const base = this.baseWhere(user, filters)
    const [all, draft, submitted, qcPending, qcApproved, rejected] = await Promise.all([
      this.prisma.db.survey.count({ where: base }),
      this.prisma.db.survey.count({ where: { AND: [base, this.tabWhere("draft")] } }),
      this.prisma.db.survey.count({ where: { AND: [base, this.tabWhere("submitted")] } }),
      this.prisma.db.survey.count({ where: { AND: [base, this.tabWhere("qcPending")] } }),
      this.prisma.db.survey.count({ where: { AND: [base, this.tabWhere("qcApproved")] } }),
      this.prisma.db.survey.count({ where: { AND: [base, this.tabWhere("rejected")] } }),
    ])
    return { all, draft, submitted, qcPending, qcApproved, rejected }
  }

  async list(user: AuthenticatedUser, query: SurveyRegistryQueryDto) {
    const { skip, take, page, limit } = getSkipTake(query)
    const base = this.baseWhere(user, query)
    const where: Prisma.SurveyWhereInput = {
      AND: [base, this.tabWhere(query.tab)],
    }

    const orderBy: Prisma.SurveyOrderByWithRelationInput =
      query.sortBy === "propertyId"
        ? { propertyId: query.sortOrder === "asc" ? "asc" : "desc" }
        : query.sortBy === "surveyStatus"
          ? { surveyStatus: query.sortOrder === "asc" ? "asc" : "desc" }
          : { createdAt: query.sortOrder === "asc" ? "asc" : "desc" }

    const searching = Boolean(query.search?.trim())

    const [rows, total, counts, scope] = await Promise.all([
      this.prisma.db.survey.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          assignedTo: { select: { id: true, fullName: true } },
          createdBy: { select: { id: true, fullName: true } },
          ward: { select: { id: true, wardName: true, wardNumber: true } },
          ulb: { select: { id: true, name: true } },
          district: { select: { id: true, name: true } },
        },
      }),
      this.prisma.db.survey.count({ where }),
      // Skip tab-count queries while searching — client keeps prior badges via keepPreviousData
      searching ? Promise.resolve(null) : this.getCounts(user, query),
      this.resolveScopeLabel(query),
    ])

    const items = rows.map((row) => ({
      id: row.id,
      status: displayStatus(row.surveyStatus, row.qcStatus),
      surveyStatus: row.surveyStatus,
      qcStatus: row.qcStatus,
      progress: progressFor(row.surveyStatus, row.completionPct),
      surveyorName: row.assignedTo?.fullName ?? row.createdBy.fullName,
      surveyorId: row.assignedToId ?? row.createdById,
      propertyId: row.propertyId,
      wardNumber: row.ward?.wardNumber ?? row.wardNumber ?? "—",
      parcelNumber: row.parcelNumber ?? "—",
      ownerName: row.respondentName ?? "—",
      surveyDate: formatSurveyDate(row.submittedAt ?? row.createdAt),
      createdAt: row.createdAt.toISOString(),
    }))

    return {
      ...toPaginatedResult(items, total, page, limit),
      counts,
      scope,
    }
  }

  private async resolveScopeLabel(query: SurveyRegistryQueryDto) {
    const [district, ulb, ward] = await Promise.all([
      query.districtId
        ? this.prisma.db.district.findUnique({ where: { id: query.districtId }, select: { name: true } })
        : null,
      query.ulbId ? this.prisma.db.ulb.findUnique({ where: { id: query.ulbId }, select: { name: true } }) : null,
      query.wardId
        ? this.prisma.db.ward.findUnique({
            where: { id: query.wardId },
            select: { wardName: true, wardNumber: true },
          })
        : null,
    ])

    if (!district && !ulb && !ward) return null

    const wardLabel = ward ? (ward.wardName?.startsWith("Ward") ? ward.wardName : `Ward ${ward.wardNumber}`) : null

    return {
      districtName: district?.name ?? null,
      ulbName: ulb?.name ?? null,
      wardName: wardLabel,
      label: [district?.name, ulb?.name, wardLabel].filter(Boolean).join(" - "),
    }
  }

  async listDraftSources(
    user: AuthenticatedUser,
    filters: Pick<SurveyRegistryQueryDto, "districtId" | "ulbId" | "wardId"> & { orphaned?: boolean }
  ) {
    const base = this.baseWhere(user, filters)
    const where: Prisma.SurveyWhereInput = {
      AND: [
        base,
        { surveyStatus: { in: EDITABLE } },
        filters.orphaned
          ? { OR: [{ assignedToId: null }, { assignedTo: { isActive: false } }] }
          : { assignedToId: { not: null } },
      ],
    }

    const grouped = await this.prisma.db.survey.groupBy({
      by: ["assignedToId"],
      where,
      _count: { _all: true },
    })

    const ids = grouped.map((g) => g.assignedToId).filter((id): id is string => Boolean(id))
    const users = ids.length
      ? await this.prisma.db.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, fullName: true },
        })
      : []
    const nameById = new Map(users.map((u) => [u.id, u.fullName]))

    return grouped
      .filter((g) => g.assignedToId)
      .map((g) => ({
        id: g.assignedToId!,
        fullName: nameById.get(g.assignedToId!) ?? "Unknown surveyor",
        draftCount: g._count._all,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }

  async reassignDrafts(
    user: AuthenticatedUser,
    params: {
      fromSurveyorId?: string
      toSurveyorId: string
      districtId?: string
      ulbId?: string
      wardId?: string
      scopeId?: string
    }
  ) {
    const wardId = params.wardId || params.scopeId
    const base = this.baseWhere(user, {
      districtId: params.districtId,
      ulbId: params.ulbId,
      wardId,
    })

    const where: Prisma.SurveyWhereInput = {
      AND: [
        base,
        { surveyStatus: { in: EDITABLE } },
        params.fromSurveyorId
          ? { assignedToId: params.fromSurveyorId }
          : { OR: [{ assignedToId: null }, { assignedTo: { isActive: false } }] },
      ],
    }

    const drafts = await this.prisma.db.survey.findMany({
      where,
      select: { id: true, assignedToId: true, createdById: true },
      take: 500,
    })

    let transferred = 0
    for (const draft of drafts) {
      if (draft.assignedToId === params.toSurveyorId) continue
      await this.prisma.db.$transaction(async (tx) => {
        await tx.survey.update({
          where: { id: draft.id },
          data: {
            assignedToId: params.toSurveyorId,
            assignedAt: new Date(),
          },
        })
        await tx.surveyAudit.create({
          data: {
            surveyId: draft.id,
            action: "SURVEY_ASSIGNED",
            changedBy: user.id,
            oldValue: { assignedToId: draft.assignedToId ?? draft.createdById },
            newValue: { assignedToId: params.toSurveyorId, reason: "registry_reassign_drafts" },
          },
        })
      })
      transferred += 1
    }

    return {
      success: true,
      transferred,
      message:
        transferred > 0
          ? `Draft items transferred successfully (${transferred}).`
          : "No draft surveys matched the current scope.",
    }
  }
}
