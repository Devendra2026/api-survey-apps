import { Injectable } from "@nestjs/common"
import { Prisma, type SurveyStatus } from "@workspace/database"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { buildTenantWhere, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { ExportFilters } from "./export.types.js"

type ExportFloorRow = {
  surveyId: string
  floorPosition: string
  usageFactor: string | null
  usageType: string | null
  constructionType: string | null
  occupancy: string | null
  areaSqFt: Prisma.Decimal | null
}

function normalizeFloorPosition(raw: string): string {
  return raw === "FIFTH_FLOOR_PLUS" ? "FIFTH_FLOOR" : raw
}

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async surveyReport(
    user: AuthenticatedUser,
    query: PaginationQueryDto & { surveyStatus?: SurveyStatus; ulbId?: string }
  ) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)
    const { skip, take, page, limit } = getSkipTake(query)

    const where: Prisma.SurveyWhereInput = {
      deletedAt: null,
      AND: [
        tenantWhere ?? {},
        query.surveyStatus ? { surveyStatus: query.surveyStatus } : {},
        query.ulbId ? { ulbId: query.ulbId } : {},
        query.search
          ? {
              OR: [
                { propertyId: { contains: query.search, mode: "insensitive" } },
                { respondentName: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    }

    const [items, total] = await Promise.all([
      this.prisma.db.survey.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "submittedAt", "surveyStatus"]),
        select: {
          id: true,
          propertyId: true,
          surveyStatus: true,
          stateId: true,
          districtId: true,
          ulbId: true,
          wardId: true,
          respondentName: true,
          mobileNumber: true,
          totalBuiltAreaSqFt: true,
          submittedAt: true,
          approvedAt: true,
          rejectedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.db.survey.count({ where }),
    ])

    return toPaginatedResult(items, total, page, limit)
  }

  async exportSurveys(user: AuthenticatedUser, filters: ExportFilters, take = 10000) {
    const scope = resolveTenantScope(user.tenantRoles)
    const tenantWhere = buildTenantWhere(scope)

    const dateFilter: Prisma.SurveyWhereInput = {}
    if (filters.dateFrom || filters.dateTo) {
      dateFilter.createdAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      }
    }

    const surveys = await this.prisma.db.survey.findMany({
      where: {
        deletedAt: null,
        ...(tenantWhere ?? {}),
        ...(filters.surveyStatus ? { surveyStatus: filters.surveyStatus } : {}),
        ...(filters.qcStatus ? { qcStatus: filters.qcStatus as never } : {}),
        ...(filters.stateId ? { stateId: filters.stateId } : {}),
        ...(filters.districtId ? { districtId: filters.districtId } : {}),
        ...(filters.ulbId ? { ulbId: filters.ulbId } : {}),
        ...(filters.wardId ? { wardId: filters.wardId } : {}),
        ...(filters.surveyorId ? { createdById: filters.surveyorId } : {}),
        ...(filters.selectedIds?.length ? { id: { in: filters.selectedIds } } : {}),
        ...dateFilter,
        ...(filters.search
          ? {
              OR: [
                { propertyId: { contains: filters.search, mode: "insensitive" } },
                { respondentName: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        propertyId: true,
        stateId: true,
        districtId: true,
        ulbId: true,
        wardId: true,
        localId: true,
        propertyIdOld: true,
        parcelNumber: true,
        unitSubNo: true,
        sectorNo: true,
        constructedYear: true,
        isSlum: true,
        wardNumber: true,
        respondentName: true,
        relationshipWithOwner: true,
        mobileNumber: true,
        alternateMobile: true,
        familySize: true,
        houseDoorNo: true,
        locality: true,
        colony: true,
        city: true,
        pinCode: true,
        assessmentYear: true,
        ownershipType: true,
        propertyUse: true,
        propertyType: true,
        situation: true,
        roadType: true,
        taxRateZone: true,
        plotAreaSqFt: true,
        plotAreaSqMeter: true,
        plinthAreaSqFt: true,
        plinthAreaSqMeter: true,
        totalBuiltAreaSqFt: true,
        totalBuiltAreaSqMeter: true,
        waterConnection: true,
        sourceOfWater: true,
        sanitationType: true,
        solidWasteCollection: true,
        electricityConsumerNo: true,
        latitude: true,
        longitude: true,
        gpsAccuracyMeters: true,
        capturedAt: true,
        gpsProvider: true,
        gpsMockLocation: true,
        qcStatus: true,
        serverVersion: true,
        clientUpdatedAt: true,
        surveyStatus: true,
        submittedAt: true,
        approvedAt: true,
        createdAt: true,
        createdBy: { select: { fullName: true, email: true } },
        ward: { select: { wardName: true, wardNumber: true } },
        ulb: { select: { name: true, code: true } },
        district: { select: { name: true } },
        coOwners: { select: { name: true, fatherOrHusbandName: true, mobile: true, alternateMobile: true } },
        photos: { select: { photoType: true, url: true, capturedAt: true, sizeKB: true, width: true, height: true } },
      },
    })

    const floorsBySurvey = await this.loadFloorsBySurveyId(surveys.map((survey) => survey.id))
    return surveys.map((survey) => ({
      ...survey,
      floors: floorsBySurvey.get(survey.id) ?? [],
    }))
  }

  /** Text-cast floors so legacy FIFTH_FLOOR_PLUS rows do not crash Prisma enum decoding. */
  private async loadFloorsBySurveyId(surveyIds: string[]) {
    const bySurvey = new Map<
      string,
      Array<{
        floorPosition: string
        usageFactor: string | null
        usageType: string | null
        constructionType: string | null
        occupancy: string | null
        areaSqFt: Prisma.Decimal | null
      }>
    >()
    if (surveyIds.length === 0) return bySurvey

    const rows = await this.prisma.db.$queryRaw<ExportFloorRow[]>`
      SELECT
        f."surveyId",
        f."floorPosition"::text AS "floorPosition",
        f."usageFactor"::text AS "usageFactor",
        f."usageType"::text AS "usageType",
        f."constructionType"::text AS "constructionType",
        f."occupancy",
        f."areaSqFt"
      FROM "floors" f
      WHERE f."surveyId" IN (${Prisma.join(surveyIds)})
    `

    for (const row of rows) {
      const list = bySurvey.get(row.surveyId) ?? []
      list.push({
        floorPosition: normalizeFloorPosition(row.floorPosition),
        usageFactor: row.usageFactor,
        usageType: row.usageType,
        constructionType: row.constructionType,
        occupancy: row.occupancy,
        areaSqFt: row.areaSqFt,
      })
      bySurvey.set(row.surveyId, list)
    }
    return bySurvey
  }
}
