import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import type { CreateCoOwnerDto, UpdateCoOwnerDto } from "../floors/dto/related.dto.js"
import { PrismaService } from "../prisma/prisma.service.js"

@Injectable()
export class CoOwnersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto, surveyId?: string) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where = surveyId ? { surveyId } : {}
    const [items, total] = await Promise.all([
      this.prisma.db.coOwner.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "name"]),
      }),
      this.prisma.db.coOwner.count({ where }),
    ])
    return toPaginatedResult(items, total, page, limit)
  }

  async findById(id: string) {
    const item = await this.prisma.db.coOwner.findUnique({ where: { id } })
    if (!item) throw new NotFoundException("CoOwner not found")
    return item
  }

  async create(data: CreateCoOwnerDto) {
    if (data.mobile) {
      const dup = await this.prisma.db.coOwner.findFirst({
        where: { surveyId: data.surveyId, mobile: data.mobile },
      })
      if (dup) {
        throw new BadRequestException("Duplicate mobile number for co-owner on this survey")
      }
    }
    return this.prisma.db.coOwner.create({ data })
  }

  async update(id: string, data: UpdateCoOwnerDto) {
    const existing = await this.findById(id)
    if (data.mobile) {
      const dup = await this.prisma.db.coOwner.findFirst({
        where: {
          surveyId: existing.surveyId,
          mobile: data.mobile,
          NOT: { id },
        },
      })
      if (dup) {
        throw new BadRequestException("Duplicate mobile number for co-owner on this survey")
      }
    }
    const { surveyId: _surveyId, ...rest } = data
    void _surveyId
    return this.prisma.db.coOwner.update({ where: { id }, data: rest })
  }

  async delete(id: string) {
    await this.findById(id)
    return this.prisma.db.coOwner.delete({ where: { id } })
  }
}
