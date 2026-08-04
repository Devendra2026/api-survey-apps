/**
 * Floors repository — CRUD with per-floor plot footprint hard checks and built-up recalculation.
 */

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import type { FloorPosition, Prisma } from "@workspace/database"
import { UsageFactor } from "@workspace/database"
import { countableFloorAreaForPlotCheck, isOpenLandPropertyUse, sumBuiltUpArea } from "@workspace/validation"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import { sqFtToSqMeter } from "../common/utils/decimal.util.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { isPrismaUniqueConflict } from "../common/utils/survey-identity.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateFloorDto, UpdateFloorDto } from "./dto/related.dto.js"
import { warningsFromSurveyRow, type FloorUsageWarning } from "./floor-usage-warnings.util.js"

const AREA_TOLERANCE_SQ_FT = 0.01

/** Hard-fail message for duplicate (surveyId, floorPosition, usageFactor). Same floor + different usage is allowed. */
function duplicateFloorUsageMessage(floorPosition: string, usageFactor: string): string {
  return `Duplicate floor usage: ${floorPosition} + ${usageFactor} already exists on this survey`
}

function toAreaNumber(value: unknown): number {
  if (value == null) return 0
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

@Injectable()
export class FloorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto, surveyId?: string) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where = surveyId ? { surveyId } : {}
    const [items, total] = await Promise.all([
      this.prisma.db.floor.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "floorPosition"]),
      }),
      this.prisma.db.floor.count({ where }),
    ])
    return toPaginatedResult(items, total, page, limit)
  }

  async findById(id: string) {
    const floor = await this.prisma.db.floor.findUnique({ where: { id } })
    if (!floor) throw new NotFoundException("Floor not found")
    return floor
  }

  /**
   * Hard check vs plot when plot is set.
   *
   * Countable area = floor row areas only (do not add survey.totalBuiltAreaSqFt — it is
   * derived from the same rows). OPEN_LAND floorPosition or usageFactor is excluded.
   * Per floorPosition: countable sum ≤ plot (footprint). Survey-wide FAR caps are not enforced.
   */
  private async assertAreasWithinPlot(
    tx: Prisma.TransactionClient,
    args: {
      surveyId: string
      floorPosition: FloorPosition
      usageFactor: string
      nextAreaSqFt: number
      excludeFloorId?: string
    }
  ) {
    const survey = await tx.survey.findUnique({
      where: { id: args.surveyId },
      select: { plotAreaSqFt: true, propertyUse: true },
    })
    if (!survey) throw new NotFoundException("Survey not found")

    if (isOpenLandPropertyUse(survey.propertyUse)) {
      throw new BadRequestException(
        "Cannot add or edit floors when Property Use is OPEN_LAND. Built-up stays N/A for open plots."
      )
    }

    const plot = survey.plotAreaSqFt != null ? toAreaNumber(survey.plotAreaSqFt) : null
    if (plot == null) return

    const floors = await tx.floor.findMany({
      where: {
        surveyId: args.surveyId,
        ...(args.excludeFloorId ? { NOT: { id: args.excludeFloorId } } : {}),
      },
      select: { floorPosition: true, usageFactor: true, areaSqFt: true },
    })

    const nextCountable = countableFloorAreaForPlotCheck(args.nextAreaSqFt, args.floorPosition, args.usageFactor)
    let floorTotal = nextCountable
    for (const row of floors) {
      if (row.floorPosition !== args.floorPosition) continue
      floorTotal += countableFloorAreaForPlotCheck(toAreaNumber(row.areaSqFt), row.floorPosition, row.usageFactor)
    }

    if (floorTotal > plot + AREA_TOLERANCE_SQ_FT) {
      throw new BadRequestException(
        `Total area on this floor exceeds plot area (${floorTotal} sq ft on ${args.floorPosition} > ${plot} sq ft plot)`
      )
    }
  }

  async create(data: CreateFloorDto) {
    if (!data.usageFactor) {
      throw new BadRequestException("Usage factor is required")
    }
    const dup = await this.prisma.db.floor.findFirst({
      where: {
        surveyId: data.surveyId,
        floorPosition: data.floorPosition,
        usageFactor: data.usageFactor,
      },
    })
    if (dup) {
      throw new BadRequestException(duplicateFloorUsageMessage(data.floorPosition, data.usageFactor))
    }

    try {
      return await this.prisma.db.$transaction(async (tx) => {
        // Approach B: one Floor row per (floorPosition, usageFactor); siblings share floorPosition.
        await this.assertAreasWithinPlot(tx, {
          surveyId: data.surveyId,
          floorPosition: data.floorPosition,
          usageFactor: data.usageFactor,
          nextAreaSqFt: toAreaNumber(data.areaSqFt),
        })

        const floor = await tx.floor.create({
          data: {
            surveyId: data.surveyId,
            floorPosition: data.floorPosition,
            usageFactor: data.usageFactor,
            usageType: data.usageType,
            constructionType: data.constructionType,
            occupancy: data.occupancy,
            areaSqFt: data.areaSqFt,
          },
        })
        const areas = await this.recalculateAreas(tx, data.surveyId)
        return { ...floor, areas }
      })
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error
      if (isPrismaUniqueConflict(error)) {
        throw new BadRequestException(duplicateFloorUsageMessage(data.floorPosition, data.usageFactor))
      }
      throw error
    }
  }

  async update(id: string, data: UpdateFloorDto) {
    const existing = await this.findById(id)
    const nextPosition = data.floorPosition ?? existing.floorPosition
    const nextUsage = data.usageFactor ?? existing.usageFactor
    const nextArea = data.areaSqFt !== undefined ? toAreaNumber(data.areaSqFt) : toAreaNumber(existing.areaSqFt)

    if (
      (data.floorPosition && data.floorPosition !== existing.floorPosition) ||
      (data.usageFactor && data.usageFactor !== existing.usageFactor)
    ) {
      const dup = await this.prisma.db.floor.findFirst({
        where: {
          surveyId: existing.surveyId,
          floorPosition: nextPosition,
          usageFactor: nextUsage,
          NOT: { id },
        },
      })
      if (dup) {
        throw new BadRequestException(duplicateFloorUsageMessage(nextPosition, nextUsage))
      }
    }

    try {
      return await this.prisma.db.$transaction(async (tx) => {
        await this.assertAreasWithinPlot(tx, {
          surveyId: existing.surveyId,
          floorPosition: nextPosition,
          usageFactor: nextUsage,
          nextAreaSqFt: nextArea,
          excludeFloorId: id,
        })

        const floor = await tx.floor.update({
          where: { id },
          data: {
            floorPosition: data.floorPosition,
            usageFactor: data.usageFactor,
            usageType: data.usageType,
            constructionType: data.constructionType,
            occupancy: data.occupancy,
            areaSqFt: data.areaSqFt,
          },
        })
        const areas = await this.recalculateAreas(tx, existing.surveyId)
        return { ...floor, areas }
      })
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error
      if (isPrismaUniqueConflict(error)) {
        throw new BadRequestException(duplicateFloorUsageMessage(nextPosition, nextUsage))
      }
      throw error
    }
  }

  async delete(id: string) {
    const existing = await this.findById(id)
    return this.prisma.db.$transaction(async (tx) => {
      await tx.floor.delete({ where: { id } })
      const areas = await this.recalculateAreas(tx, existing.surveyId)
      return { id, areas }
    })
  }

  async recalculateAreas(tx: Prisma.TransactionClient, surveyId: string) {
    const survey = await tx.survey.findUnique({
      where: { id: surveyId },
      select: { propertyUse: true },
    })
    const floors = await tx.floor.findMany({ where: { surveyId } })

    let totalBuilt = 0
    let residential = 0
    let commercial = 0

    if (!isOpenLandPropertyUse(survey?.propertyUse)) {
      totalBuilt = sumBuiltUpArea(
        floors.map((f) => ({
          floorPosition: f.floorPosition,
          usageFactor: f.usageFactor,
          areaSqFt: f.areaSqFt != null ? Number(f.areaSqFt) : 0,
        }))
      )
      for (const f of floors) {
        const area = countableFloorAreaForPlotCheck(f.areaSqFt ? Number(f.areaSqFt) : 0, f.floorPosition, f.usageFactor)
        if (f.usageFactor === UsageFactor.RESIDENTIAL) residential += area
        if (f.usageFactor === UsageFactor.COMMERCIAL) commercial += area
      }
    }

    await tx.survey.update({
      where: { id: surveyId },
      data: {
        totalBuiltAreaSqFt: totalBuilt,
        totalBuiltAreaSqMeter: sqFtToSqMeter(totalBuilt),
      },
    })

    return {
      totalBuiltAreaSqFt: totalBuilt,
      totalResidentialAreaSqFt: residential,
      totalCommercialAreaSqFt: commercial,
    }
  }

  async getUsageWarnings(surveyId: string): Promise<FloorUsageWarning[]> {
    const survey = await this.prisma.db.survey.findUnique({
      where: { id: surveyId },
      select: {
        propertyUse: true,
        propertyType: true,
        plotAreaSqFt: true,
        plinthAreaSqFt: true,
        totalBuiltAreaSqFt: true,
        floors: {
          select: {
            floorPosition: true,
            usageFactor: true,
            areaSqFt: true,
          },
        },
      },
    })
    if (!survey) return []
    return warningsFromSurveyRow(survey)
  }
}
