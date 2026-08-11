import { Injectable } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { PrismaService } from "../prisma/prisma.service.js"

/** Columns that exist on production before migration 20260811120000. */
const surveyAuditSafeSelect = {
  id: true,
  surveyId: true,
  action: true,
  oldValue: true,
  newValue: true,
  changedBy: true,
  changedAt: true,
  changer: { select: { id: true, fullName: true, email: true } },
} as const

@Injectable()
export class SurveyAuditsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto, surveyId?: string) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where = surveyId ? { surveyId } : {}
    const [items, total] = await Promise.all([
      this.prisma.db.surveyAudit.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["changedAt", "action"], "changedAt"),
        select: surveyAuditSafeSelect,
      }),
      this.prisma.db.surveyAudit.count({ where }),
    ])
    return toPaginatedResult(items, total, page, limit)
  }

  findBySurvey(surveyId: string) {
    return this.prisma.db.surveyAudit.findMany({
      where: { surveyId },
      orderBy: { changedAt: "desc" },
      select: surveyAuditSafeSelect,
    })
  }
}
