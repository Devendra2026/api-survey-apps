import { Injectable, NotFoundException } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreatePermissionDto, UpdatePermissionDto } from "../roles/dto/role.dto.js"

@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where = query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}

    const [items, total] = await Promise.all([
      this.prisma.db.permission.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "name"], "name"),
      }),
      this.prisma.db.permission.count({ where }),
    ])
    return toPaginatedResult(items, total, page, limit)
  }

  async findById(id: string) {
    const item = await this.prisma.db.permission.findUnique({ where: { id } })
    if (!item) throw new NotFoundException("Permission not found")
    return item
  }

  create(data: CreatePermissionDto) {
    return this.prisma.db.permission.create({ data })
  }

  async update(id: string, data: UpdatePermissionDto) {
    await this.findById(id)
    return this.prisma.db.permission.update({ where: { id }, data })
  }

  async delete(id: string) {
    await this.findById(id)
    return this.prisma.db.permission.delete({ where: { id } })
  }
}
