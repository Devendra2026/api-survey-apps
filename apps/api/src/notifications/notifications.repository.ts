import { Injectable } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildTenantWhere, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { PrismaService } from "../prisma/prisma.service.js"

const NOTIFICATION_ACTIONS = [
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "REOPENED",
  "SURVEY_ASSIGNED",
  "STATUS_IN_PROGRESS",
] as const

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findForUser(user: AuthenticatedUser, query: PaginationQueryDto) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const { skip, take, page, limit } = getSkipTake(query)

    const surveyFilter: Prisma.SurveyWhereInput = {
      deletedAt: null,
      ...(tenantWhere ?? {}),
    }

    const where: Prisma.SurveyAuditWhereInput = {
      action: { in: [...NOTIFICATION_ACTIONS] },
      OR: [
        { changedBy: user.id },
        { survey: { ...surveyFilter, createdById: user.id } },
        {
          survey: surveyFilter,
          action: { in: ["SUBMITTED", "APPROVED", "REJECTED", "SURVEY_ASSIGNED"] },
        },
      ],
    }

    const [items, total] = await Promise.all([
      this.prisma.db.surveyAudit.findMany({
        where,
        skip,
        take,
        orderBy: { changedAt: "desc" },
        include: {
          survey: {
            select: {
              id: true,
              propertyId: true,
              surveyStatus: true,
              createdById: true,
            },
          },
          changer: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.db.surveyAudit.count({ where }),
    ])

    const notifications = items.map((item) => ({
      id: item.id,
      type: item.action,
      message: this.formatMessage(item.action, item.survey.propertyId),
      surveyId: item.surveyId,
      propertyId: item.survey.propertyId,
      surveyStatus: item.survey.surveyStatus,
      changedBy: item.changer,
      changedAt: item.changedAt,
      isOwnSurvey: item.survey.createdById === user.id,
    }))

    return toPaginatedResult(notifications, total, page, limit)
  }

  async countUnread(user: AuthenticatedUser) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)

    const surveyFilter: Prisma.SurveyWhereInput = {
      deletedAt: null,
      ...(tenantWhere ?? {}),
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    return this.prisma.db.surveyAudit.count({
      where: {
        changedAt: { gte: since },
        action: { in: [...NOTIFICATION_ACTIONS] },
        OR: [
          { changedBy: user.id },
          { survey: { ...surveyFilter, createdById: user.id } },
          {
            survey: surveyFilter,
            action: { in: ["SUBMITTED", "APPROVED", "REJECTED", "SURVEY_ASSIGNED"] },
          },
        ],
      },
    })
  }

  private formatMessage(action: string, propertyId: string) {
    switch (action) {
      case "SUBMITTED":
        return `Survey ${propertyId} was submitted for review`
      case "APPROVED":
        return `Survey ${propertyId} was approved`
      case "REJECTED":
        return `Survey ${propertyId} was rejected`
      case "REOPENED":
        return `Survey ${propertyId} was reopened for corrections`
      case "SURVEY_ASSIGNED":
        return `Survey ${propertyId} was assigned to a surveyor`
      case "STATUS_IN_PROGRESS":
        return `Survey ${propertyId} is now in progress`
      default:
        return `Survey ${propertyId} was updated`
    }
  }
}
