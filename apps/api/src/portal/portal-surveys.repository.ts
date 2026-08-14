import { BadRequestException, Injectable } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { PortalSurveyQueryDto } from "./dto/portal-survey-query.dto.js"

export type PortalSurveySummary = {
  id: string
  propertyId: string
  parcelNumber: string | null
  surveyStatus: string
  qcStatus: string
  respondentName: string | null
  assessmentYear: string
  ward: { id: string; wardNumber: string; wardName: string }
}

@Injectable()
export class PortalSurveysRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(ulbId: string, query: PortalSurveyQueryDto) {
    if (query.wardId) {
      const ward = await this.prisma.db.ward.findFirst({
        where: { id: query.wardId, ulbId, deletedAt: null },
        select: { id: true },
      })
      if (!ward) {
        throw new BadRequestException("Ward is not in this ULB")
      }
    }

    const { skip, take, page, limit } = getSkipTake(query)
    const where: Prisma.SurveyWhereInput = {
      ulbId,
      deletedAt: null,
      ...(query.wardId ? { wardId: query.wardId } : {}),
      ...(query.search
        ? {
            OR: [
              { propertyId: { contains: query.search, mode: "insensitive" } },
              { parcelNumber: { contains: query.search, mode: "insensitive" } },
              { respondentName: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      this.prisma.db.survey.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(
          query.sortBy,
          query.sortOrder,
          ["createdAt", "parcelNumber", "propertyId", "surveyStatus"],
          "createdAt"
        ),
        select: {
          id: true,
          propertyId: true,
          parcelNumber: true,
          surveyStatus: true,
          qcStatus: true,
          respondentName: true,
          assessmentYear: true,
          ward: { select: { id: true, wardNumber: true, wardName: true } },
        },
      }),
      this.prisma.db.survey.count({ where }),
    ])

    const items: PortalSurveySummary[] = rows.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      parcelNumber: row.parcelNumber,
      surveyStatus: row.surveyStatus,
      qcStatus: row.qcStatus,
      respondentName: row.respondentName,
      assessmentYear: row.assessmentYear,
      ward: row.ward,
    }))

    return toPaginatedResult(items, total, page, limit)
  }
}
