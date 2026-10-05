import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import type { Prisma, SurveyStatus } from "@workspace/database"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { allocateTempPropertyId, findActiveSurveyIdentityConflict } from "../common/utils/survey-identity.util.js"
import { buildTenantWhere, canAccessTenant, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateSurveyDto, SurveyQueryDto, UpdateSurveyDto } from "./dto/survey.dto.js"
import type { FieldMetricsScope, SurveyorInfo, WardInfo } from "./field-metrics.js"
import { createSurveyAuditRow } from "./survey-audit-write.js"

const surveyInclude = {
  floors: { orderBy: { position: "asc" as const } },
  photos: { orderBy: { createdAt: "asc" as const } },
  coOwners: { orderBy: { ownerIndex: "asc" as const } },
  createdBy: { select: { id: true, fullName: true, email: true } },
  assignedTo: { select: { id: true, fullName: true, email: true } },
  ward: { select: { id: true, wardName: true, wardNumber: true, kind: true } },
  originalWard: { select: { id: true, wardName: true, wardNumber: true, kind: true } },
  ulb: { select: { id: true, name: true, code: true } },
  district: { select: { id: true, name: true } },
  state: { select: { id: true, name: true } },
} as const

const surveyViewInclude = {
  ...surveyInclude,
  qcRemarkThread: {
    orderBy: { createdAt: "desc" as const },
    take: 50,
    include: { author: { select: { id: true, fullName: true } } },
  },
  // Intentionally omit `audits` — QC/Survey detail loads history via /audit-history.
  // Including audits forces Prisma to SELECT all SurveyAudit columns and breaks detail
  // when the API client is ahead of the DB migration.
} as const

export type QcRemarkInput = {
  body: string
  section: string | null
  field: string | null
  reason: string | null
}

type SurveyCursor = {
  createdAt: string
  id: string
}

function decodeSurveyCursor(cursor: string): SurveyCursor {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("id" in decoded) ||
      !("createdAt" in decoded) ||
      typeof decoded.id !== "string" ||
      typeof decoded.createdAt !== "string" ||
      Number.isNaN(Date.parse(decoded.createdAt))
    ) {
      throw new Error("Invalid cursor shape")
    }
    return { id: decoded.id, createdAt: decoded.createdAt }
  } catch {
    throw new BadRequestException("Invalid survey cursor")
  }
}

function encodeSurveyCursor(survey: { id: string; createdAt: Date }): string {
  return Buffer.from(JSON.stringify({ id: survey.id, createdAt: survey.createdAt.toISOString() })).toString("base64url")
}

@Injectable()
export class SurveysRepository {
  private readonly logger = new Logger(SurveysRepository.name)
  constructor(private readonly prisma: PrismaService) {}

  private baseWhere(user: AuthenticatedUser, query?: SurveyQueryDto): Prisma.SurveyWhereInput {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const createdAt: Prisma.DateTimeFilter = {}
    if (query?.dateFrom) createdAt.gte = new Date(query.dateFrom)
    if (query?.dateTo) {
      const end = new Date(query.dateTo)
      end.setUTCHours(23, 59, 59, 999)
      createdAt.lte = end
    }

    return {
      deletedAt: null,
      AND: [
        tenantWhere ?? {},
        query?.surveyStatus ? { surveyStatus: query.surveyStatus } : {},
        query?.qcStatus ? { qcStatus: query.qcStatus } : {},
        query?.stateId ? { stateId: query.stateId } : {},
        query?.districtId ? { districtId: query.districtId } : {},
        query?.ulbId ? { ulbId: query.ulbId } : {},
        query?.wardId ? { wardId: query.wardId } : {},
        query?.surveyorId ? { assignedToId: query.surveyorId } : {},
        Object.keys(createdAt).length > 0 ? { createdAt } : {},
        query?.mobile
          ? {
              OR: [
                { mobileNumber: { contains: query.mobile, mode: "insensitive" } },
                { alternateMobile: { contains: query.mobile, mode: "insensitive" } },
              ],
            }
          : {},
        query?.search
          ? {
              OR: [
                { propertyId: { contains: query.search, mode: "insensitive" } },
                { respondentName: { contains: query.search, mode: "insensitive" } },
                { mobileNumber: { contains: query.search, mode: "insensitive" } },
                { houseDoorNo: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    }
  }

  async findAll(query: SurveyQueryDto, user: AuthenticatedUser) {
    if (query.cursorPagination === "true") {
      if (query.sortBy && query.sortBy !== "createdAt") {
        throw new BadRequestException("Cursor pagination only supports sorting by createdAt")
      }

      const cursor = query.cursor ? decodeSurveyCursor(query.cursor) : undefined
      const limit = query.limit ?? 20
      const direction = query.sortOrder === "asc" ? "asc" : "desc"
      const rows = await this.prisma.db.survey.findMany({
        where: this.baseWhere(user, query),
        ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
        take: limit + 1,
        orderBy: [{ createdAt: direction }, { id: direction }],
        include: surveyInclude,
      })
      const hasMore = rows.length > limit
      const items = hasMore ? rows.slice(0, limit) : rows
      const lastItem = items.at(-1)

      return {
        items,
        meta: { limit, nextCursor: hasMore && lastItem ? encodeSurveyCursor(lastItem) : null },
      }
    }

    const { skip, take, page, limit } = getSkipTake(query)
    const where = this.baseWhere(user, query)
    const [items, total] = await Promise.all([
      this.prisma.db.survey.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(
          query.sortBy,
          query.sortOrder,
          ["createdAt", "updatedAt", "propertyId", "surveyStatus", "qcStatus", "submittedAt"],
          "createdAt"
        ),
        include: surveyInclude,
      }),
      this.prisma.db.survey.count({ where }),
    ])
    return toPaginatedResult(items, total, page, limit)
  }

  async wardCommandStats(user: AuthenticatedUser, opts: { limit?: number; districtId?: string; ulbId?: string } = {}) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const where: Prisma.SurveyWhereInput = {
      deletedAt: null,
      ...(tenantWhere ?? {}),
      ...(opts.districtId ? { districtId: opts.districtId } : {}),
      ...(opts.ulbId ? { ulbId: opts.ulbId } : {}),
    }

    const rows = await this.prisma.db.survey.groupBy({
      by: ["wardId", "surveyStatus"],
      where,
      _count: { _all: true },
    })

    const byWard = new Map<string, { id: string; count: number; byStatus: Record<string, number> }>()
    let missingWardSurveys = 0
    for (const row of rows) {
      if (!row.wardId) {
        missingWardSurveys += row._count._all
        continue
      }
      const current = byWard.get(row.wardId) ?? { id: row.wardId, count: 0, byStatus: {} }
      current.count += row._count._all
      current.byStatus[row.surveyStatus] = (current.byStatus[row.surveyStatus] ?? 0) + row._count._all
      byWard.set(row.wardId, current)
    }
    if (missingWardSurveys > 0) {
      this.logger.warn(`wardCommandStats: ${missingWardSurveys} surveys grouped with a null wardId`)
    }

    const top = [...byWard.values()].sort((a, b) => b.count - a.count).slice(0, opts.limit ?? 8)
    if (top.length === 0) return []

    const wards = await this.prisma.db.ward.findMany({
      where: { id: { in: top.map((w) => w.id) } },
      select: { id: true, wardName: true, wardNumber: true, ulbId: true },
    })
    const wardMap = new Map(wards.map((w) => [w.id, w]))

    return top.map((ward) => {
      const detail = wardMap.get(ward.id)
      return {
        id: ward.id,
        name: detail?.wardName || (detail ? `Ward ${detail.wardNumber}` : "Unknown ward"),
        wardNumber: detail?.wardNumber ?? null,
        ulbId: detail?.ulbId ?? null,
        count: ward.count,
        byStatus: ward.byStatus,
      }
    })
  }

  async findAccessibleByIds(ids: string[], user: AuthenticatedUser) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    return this.prisma.db.survey.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        ...(tenantWhere ?? {}),
      },
      select: {
        id: true,
        createdById: true,
        surveyStatus: true,
        qcStatus: true,
      },
    })
  }

  async findById(id: string, user: AuthenticatedUser) {
    const scope = resolveTenantScope(user.tenantRoles)

    // Resolve identity without tenant filter so we can distinguish missing vs out-of-scope.
    const survey = await this.prisma.db.survey.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id }, { propertyId: id }, { legacySurveyId: id }],
      },
      include: surveyViewInclude,
    })
    if (!survey) throw new NotFoundException("Survey not found")

    if (
      !canAccessTenant(scope, {
        stateId: survey.stateId,
        districtId: survey.districtId,
        ulbId: survey.ulbId,
        wardId: survey.wardId,
      })
    ) {
      throw new ForbiddenException("Survey is outside your tenant scope")
    }

    return survey
  }

  async findByIdRaw(id: string) {
    return this.prisma.db.survey.findFirst({
      where: { id, deletedAt: null },
      include: surveyInclude,
    })
  }

  async createWithAudit(
    data: CreateSurveyDto & { createdById: string; assignedToId?: string; assignedAt?: Date },
    changedBy: string
  ) {
    return this.prisma.db.$transaction(async (tx) => {
      const survey = await tx.survey.create({
        data: {
          ...data,
          surveyStatus: "DRAFT",
          assignedToId: data.assignedToId ?? data.createdById,
          assignedAt: data.assignedAt ?? new Date(),
          capturedAt: data.capturedAt ? new Date(data.capturedAt) : undefined,
        },
        include: surveyInclude,
      })
      await createSurveyAuditRow(tx, {
        surveyId: survey.id,
        action: "CREATED",
        newValue: { surveyStatus: "DRAFT", propertyId: survey.propertyId },
        changedBy,
      })
      return survey
    })
  }

  async update(id: string, data: UpdateSurveyDto) {
    const { capturedAt, ...rest } = data
    return this.prisma.db.survey.update({
      where: { id },
      data: {
        ...rest,
        ...(capturedAt !== undefined ? { capturedAt: capturedAt ? new Date(capturedAt) : null } : {}),
      },
      include: surveyInclude,
    })
  }

  softDelete(id: string, changedBy: string) {
    return this.prisma.db.$transaction(async (tx) => {
      const survey = await tx.survey.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      await createSurveyAuditRow(tx, {
        surveyId: id,
        action: "DELETED",
        oldValue: { deletedAt: null },
        newValue: { deletedAt: survey.deletedAt },
        changedBy,
      })
      return survey
    })
  }

  async restore(id: string, user: AuthenticatedUser) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const existing = await this.prisma.db.survey.findFirst({
      where: {
        id,
        deletedAt: { not: null },
        ...(tenantWhere ?? {}),
      },
    })
    if (!existing) throw new NotFoundException("Deleted survey not found")

    return this.prisma.db.$transaction(async (tx) => {
      const conflict = await findActiveSurveyIdentityConflict(tx, {
        ulbId: existing.ulbId,
        propertyId: existing.propertyId,
        assessmentYear: existing.assessmentYear,
        excludeId: existing.id,
      })

      const restoreData: Prisma.SurveyUpdateInput = { deletedAt: null }
      let rekeyedPropertyId: string | null = null
      if (conflict) {
        rekeyedPropertyId = allocateTempPropertyId("TEMP-RESTORE")
        restoreData.propertyId = rekeyedPropertyId
        if (!existing.propertyIdOld) {
          restoreData.propertyIdOld = existing.propertyId
        }
      }

      const survey = await tx.survey.update({
        where: { id },
        data: restoreData,
        include: surveyInclude,
      })
      await createSurveyAuditRow(tx, {
        surveyId: id,
        action: "RESTORED",
        oldValue: {
          deletedAt: existing.deletedAt,
          propertyId: existing.propertyId,
        },
        newValue: {
          deletedAt: null,
          propertyId: survey.propertyId,
          rekeyed: rekeyedPropertyId != null,
          previousPropertyId: rekeyedPropertyId != null ? existing.propertyId : undefined,
        },
        changedBy: user.id,
      })
      return survey
    })
  }

  transitionStatus(params: {
    id: string
    from: SurveyStatus
    to: SurveyStatus
    changedBy: string
    action: string
    extra?: Prisma.SurveyUpdateInput
    auditNew?: Prisma.InputJsonValue
    /** Structured QC remarks authored by `changedBy`, written atomically with the transition. */
    createQcRemarks?: QcRemarkInput[]
    /** Mark every open QC remark resolved (correction resubmitted). */
    resolveOpenQcRemarks?: boolean
  }) {
    return this.prisma.db.$transaction(async (tx) => {
      const updated = await tx.survey.updateMany({
        where: {
          id: params.id,
          deletedAt: null,
          surveyStatus: params.from,
        },
        data: {
          surveyStatus: params.to,
          ...(params.extra as Prisma.SurveyUpdateManyMutationInput),
        },
      })
      if (updated.count === 0) {
        throw new NotFoundException(`Survey not found or not in status ${params.from}`)
      }

      if (params.createQcRemarks?.length) {
        await tx.qcRemark.createMany({
          data: params.createQcRemarks.map((remark) => ({
            surveyId: params.id,
            authorId: params.changedBy,
            body: remark.body,
            section: remark.section,
            field: remark.field,
            reason: remark.reason,
          })),
        })
      }
      if (params.resolveOpenQcRemarks) {
        await tx.qcRemark.updateMany({
          where: { surveyId: params.id, resolvedAt: null },
          data: { resolvedAt: new Date() },
        })
      }

      const survey = await tx.survey.findFirstOrThrow({
        where: { id: params.id },
        include: surveyInclude,
      })

      await createSurveyAuditRow(tx, {
        surveyId: params.id,
        action: params.action,
        oldValue: { surveyStatus: params.from },
        newValue: params.auditNew ?? { surveyStatus: params.to },
        changedBy: params.changedBy,
      })

      return { current: survey, survey }
    })
  }

  listAudits(surveyId: string) {
    // Prefer columns that carry Convex actor snapshots when migration is applied.
    // Fall back to pre-migration columns so QC still works if schema is behind.
    const withLegacyFields = {
      id: true,
      action: true,
      changedAt: true,
      oldValue: true,
      newValue: true,
      changedBy: true,
      actorDisplayName: true,
      actorRole: true,
      details: true,
      sourceEventId: true,
      changer: { select: { id: true, fullName: true, email: true } },
    } as const
    const preMigration = {
      id: true,
      action: true,
      changedAt: true,
      oldValue: true,
      newValue: true,
      changedBy: true,
      changer: { select: { id: true, fullName: true, email: true } },
    } as const

    return this.prisma.db.surveyAudit
      .findMany({
        where: { surveyId },
        orderBy: { changedAt: "desc" },
        select: withLegacyFields,
      })
      .catch(() =>
        this.prisma.db.surveyAudit.findMany({
          where: { surveyId },
          orderBy: { changedAt: "desc" },
          select: preMigration,
        })
      )
  }

  /**
   * Grouped counts for the mobile Field dashboard. Always tenant-scoped; `self` narrows to the caller's own
   * assigned surveys, `team` returns per-surveyor progress for everyone inside the caller's scope.
   */
  async fieldMetrics(user: AuthenticatedUser, opts: { scope: FieldMetricsScope; todayStart: Date }) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const where: Prisma.SurveyWhereInput = {
      deletedAt: null,
      AND: [tenantWhere ?? {}, opts.scope === "self" ? { assignedToId: user.id } : {}],
    }

    const [statusRows, createdTodayRows, submittedTodayRows, resubmitted] = await Promise.all([
      this.prisma.db.survey.groupBy({
        by: ["wardId", "assignedToId", "surveyStatus", "qcStatus"],
        where,
        _count: { _all: true },
      }),
      this.prisma.db.survey.groupBy({
        by: ["assignedToId"],
        where: { AND: [where, { createdAt: { gte: opts.todayStart } }] },
        _count: { _all: true },
      }),
      this.prisma.db.survey.groupBy({
        by: ["assignedToId"],
        where: { AND: [where, { submittedAt: { gte: opts.todayStart } }] },
        _count: { _all: true },
      }),
      this.prisma.db.survey.count({
        where: {
          AND: [
            where,
            { surveyStatus: "SUBMITTED", qcStatus: "PENDING" },
            { audits: { some: { action: "REOPENED" } } },
          ],
        },
      }),
    ])

    const missingWardSurveys = statusRows.reduce((sum, row) => sum + (row.wardId ? 0 : row._count._all), 0)
    if (missingWardSurveys > 0) {
      this.logger.warn(`fieldMetrics: ${missingWardSurveys} surveys grouped with a null wardId (scope=${opts.scope})`)
    }
    const wardIds = [...new Set(statusRows.map((row) => row.wardId).filter((id): id is string => Boolean(id)))]
    const wardRows = wardIds.length
      ? await this.prisma.db.ward.findMany({
          where: { id: { in: wardIds } },
          select: { id: true, wardNumber: true, wardName: true, ulb: { select: { name: true } } },
        })
      : []
    const wards: WardInfo[] = wardRows.map((w) => ({
      id: w.id,
      wardNumber: w.wardNumber,
      wardName: w.wardName,
      ulbName: w.ulb?.name ?? null,
    }))

    if (opts.scope === "self") {
      return {
        statusRows,
        createdTodayRows,
        submittedTodayRows,
        resubmitted,
        wards,
        surveyors: [] as SurveyorInfo[],
        lastActivityByUser: new Map<string, Date>(),
        assignedSurveyorCount: null,
      }
    }

    const roleWhere: Prisma.UserTenantRoleWhereInput = {
      isActive: true,
      role: { name: "SURVEYOR" },
      user: { isActive: true },
      ...(scope.isGlobal
        ? {}
        : {
            OR: [
              ...(scope.wardIds.length ? [{ wardId: { in: scope.wardIds } }] : []),
              // ULB-wide surveyors also work inside a ward-scoped supervisor's wards.
              ...(scope.parentUlbIds.length ? [{ wardId: null, ulbId: { in: scope.parentUlbIds } }] : []),
              ...(scope.ulbIds.length ? [{ ulbId: { in: scope.ulbIds } }] : []),
              ...(scope.districtIds.length ? [{ districtId: { in: scope.districtIds } }] : []),
              ...(scope.stateIds.length ? [{ stateId: { in: scope.stateIds } }] : []),
              { id: "__no_access__" },
            ],
          }),
    }

    const assigneeIds = [...new Set(statusRows.map((r) => r.assignedToId).filter((id): id is string => Boolean(id)))]

    const [surveyorRoles, assignees, activityRows] = await Promise.all([
      this.prisma.db.userTenantRole.findMany({
        where: roleWhere,
        select: {
          userId: true,
          user: { select: { fullName: true } },
          ward: { select: { wardNumber: true } },
          ulb: { select: { name: true } },
        },
        take: 1000,
      }),
      assigneeIds.length
        ? this.prisma.db.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true, fullName: true },
          })
        : Promise.resolve([] as Array<{ id: string; fullName: string }>),
      this.prisma.db.survey.groupBy({
        by: ["assignedToId"],
        where,
        _max: { updatedAt: true },
      }),
    ])

    const surveyorMap = new Map<string, SurveyorInfo>()
    for (const role of surveyorRoles) {
      const current = surveyorMap.get(role.userId) ?? { userId: role.userId, fullName: role.user.fullName, wards: [] }
      const label = role.ward ? `Ward ${role.ward.wardNumber}` : role.ulb ? `${role.ulb.name} (all wards)` : null
      if (label && !current.wards.includes(label)) current.wards.push(label)
      surveyorMap.set(role.userId, current)
    }
    const assignedSurveyorCount = surveyorMap.size
    for (const assignee of assignees) {
      if (!surveyorMap.has(assignee.id)) {
        surveyorMap.set(assignee.id, { userId: assignee.id, fullName: assignee.fullName, wards: [] })
      }
    }

    const lastActivityByUser = new Map<string, Date>()
    for (const row of activityRows) {
      if (row.assignedToId && row._max.updatedAt) lastActivityByUser.set(row.assignedToId, row._max.updatedAt)
    }

    return {
      statusRows,
      createdTodayRows,
      submittedTodayRows,
      resubmitted,
      wards,
      surveyors: [...surveyorMap.values()],
      lastActivityByUser,
      assignedSurveyorCount,
    }
  }

  async assignSurvey(params: { id: string; assigneeId: string; changedBy: string; previousAssigneeId: string }) {
    return this.prisma.db.$transaction(async (tx) => {
      const survey = await tx.survey.update({
        where: { id: params.id },
        data: {
          assignedToId: params.assigneeId,
          assignedAt: new Date(),
        },
        include: surveyInclude,
      })

      await createSurveyAuditRow(tx, {
        surveyId: params.id,
        action: "SURVEY_ASSIGNED",
        oldValue: { assignedToId: params.previousAssigneeId },
        newValue: { assignedToId: params.assigneeId },
        changedBy: params.changedBy,
      })

      return survey
    })
  }
}
