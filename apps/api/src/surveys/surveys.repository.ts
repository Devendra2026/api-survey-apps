import { Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma, SurveyStatus } from "@workspace/database"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { buildTenantWhere, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateSurveyDto, SurveyQueryDto, UpdateSurveyDto } from "./dto/survey.dto.js"

const surveyInclude = {
  floors: true,
  photos: true,
  coOwners: true,
  createdBy: { select: { id: true, fullName: true, email: true } },
  ward: { select: { id: true, wardName: true, wardNumber: true } },
  ulb: { select: { id: true, name: true } },
  district: { select: { id: true, name: true } },
  state: { select: { id: true, name: true } },
} as const

@Injectable()
export class SurveysRepository {
  constructor(private readonly prisma: PrismaService) {}

  private baseWhere(user: AuthenticatedUser, query?: SurveyQueryDto): Prisma.SurveyWhereInput {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    return {
      deletedAt: null,
      AND: [
        tenantWhere ?? {},
        query?.surveyStatus ? { surveyStatus: query.surveyStatus } : {},
        query?.stateId ? { stateId: query.stateId } : {},
        query?.districtId ? { districtId: query.districtId } : {},
        query?.ulbId ? { ulbId: query.ulbId } : {},
        query?.wardId ? { wardId: query.wardId } : {},
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
          ["createdAt", "updatedAt", "propertyId", "surveyStatus", "submittedAt"],
          "createdAt"
        ),
        include: surveyInclude,
      }),
      this.prisma.db.survey.count({ where }),
    ])
    return toPaginatedResult(items, total, page, limit)
  }

  async findById(id: string, user: AuthenticatedUser) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const survey = await this.prisma.db.survey.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(tenantWhere ?? {}),
      },
      include: {
        ...surveyInclude,
        audits: { orderBy: { changedAt: "desc" }, take: 50 },
      },
    })
    if (!survey) throw new NotFoundException("Survey not found")
    return survey
  }

  async findByIdRaw(id: string) {
    return this.prisma.db.survey.findFirst({
      where: { id, deletedAt: null },
      include: surveyInclude,
    })
  }

  async createWithAudit(data: CreateSurveyDto & { createdById: string }, changedBy: string) {
    return this.prisma.db.$transaction(async (tx) => {
      const survey = await tx.survey.create({
        data: {
          ...data,
          surveyStatus: "DRAFT",
          capturedAt: data.capturedAt ? new Date(data.capturedAt) : undefined,
        },
        include: surveyInclude,
      })
      await tx.surveyAudit.create({
        data: {
          surveyId: survey.id,
          action: "CREATED",
          newValue: { surveyStatus: "DRAFT", propertyId: survey.propertyId },
          changedBy,
        },
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
      await tx.surveyAudit.create({
        data: {
          surveyId: id,
          action: "DELETED",
          oldValue: { deletedAt: null },
          newValue: { deletedAt: survey.deletedAt },
          changedBy,
        },
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
      const survey = await tx.survey.update({
        where: { id },
        data: { deletedAt: null },
        include: surveyInclude,
      })
      await tx.surveyAudit.create({
        data: {
          surveyId: id,
          action: "RESTORED",
          oldValue: { deletedAt: existing.deletedAt },
          newValue: { deletedAt: null },
          changedBy: user.id,
        },
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

      const survey = await tx.survey.findFirstOrThrow({
        where: { id: params.id },
        include: surveyInclude,
      })

      await tx.surveyAudit.create({
        data: {
          surveyId: params.id,
          action: params.action,
          oldValue: { surveyStatus: params.from },
          newValue: params.auditNew ?? { surveyStatus: params.to },
          changedBy: params.changedBy,
        },
      })

      return { current: survey, survey }
    })
  }

  listAudits(surveyId: string) {
    return this.prisma.db.surveyAudit.findMany({
      where: { surveyId },
      orderBy: { changedAt: "desc" },
      include: {
        changer: { select: { id: true, fullName: true, email: true } },
      },
    })
  }

  async assignSurvey(params: {
    id: string
    assigneeId: string
    changedBy: string
    previousAssigneeId: string
  }) {
    return this.prisma.db.$transaction(async (tx) => {
      const survey = await tx.survey.update({
        where: { id: params.id },
        data: { createdById: params.assigneeId },
        include: surveyInclude,
      })

      await tx.surveyAudit.create({
        data: {
          surveyId: params.id,
          action: "SURVEY_ASSIGNED",
          oldValue: { createdById: params.previousAssigneeId },
          newValue: { createdById: params.assigneeId },
          changedBy: params.changedBy,
        },
      })

      return survey
    })
  }
}
