import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import { usageFactor } from "@workspace/database"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import { sqFtToSqMeter } from "../common/utils/decimal.util.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateFloorDto, UpdateFloorDto } from "./dto/related.dto.js"

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

  async create(data: CreateFloorDto) {
    const dup = await this.prisma.db.floor.findFirst({
      where: { surveyId: data.surveyId, floorPosition: data.floorPosition },
    })
    if (dup) {
      throw new BadRequestException(`Duplicate floor position: ${data.floorPosition}`)
    }

    return this.prisma.db.$transaction(async (tx) => {
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
  }

  async update(id: string, data: UpdateFloorDto) {
    const existing = await this.findById(id)
    if (data.floorPosition && data.floorPosition !== existing.floorPosition) {
      const dup = await this.prisma.db.floor.findFirst({
        where: {
          surveyId: existing.surveyId,
          floorPosition: data.floorPosition,
          NOT: { id },
        },
      })
      if (dup) {
        throw new BadRequestException(`Duplicate floor position: ${data.floorPosition}`)
      }
    }

    return this.prisma.db.$transaction(async (tx) => {
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
    const floors = await tx.floor.findMany({ where: { surveyId } })
    let totalBuilt = 0
    let residential = 0
    let commercial = 0

    for (const f of floors) {
      const area = f.areaSqFt ? Number(f.areaSqFt) : 0
      totalBuilt += area
      if (f.usageFactor === usageFactor.RESIDENTIAL) residential += area
      if (f.usageFactor === usageFactor.COMMERCIAL) commercial += area
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
}
