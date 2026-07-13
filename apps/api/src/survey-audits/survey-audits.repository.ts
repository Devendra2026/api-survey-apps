import { Injectable } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { PrismaService } from "../prisma/prisma.service.js"

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
        include: {
          changer: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.db.surveyAudit.count({ where }),
    ])
    return toPaginatedResult(items, total, page, limit)
  }

  findBySurvey(surveyId: string) {
    return this.prisma.db.surveyAudit.findMany({
      where: { surveyId },
      orderBy: { changedAt: "desc" },
      include: {
        changer: { select: { id: true, fullName: true, email: true } },
      },
    })
  }
}
