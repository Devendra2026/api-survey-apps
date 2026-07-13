import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateStateDto, UpdateStateDto } from "./dto/geo.dto.js"

@Injectable()
export class StatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private scopedWhere(user: AuthenticatedUser): Prisma.StateWhereInput {
    const scope = resolveTenantScope(user.tenantRoles)
    if (scope.isGlobal) return {}
    if (scope.stateIds.length) return { id: { in: scope.stateIds } }
    // Lower-level scopes: discover states via related assignments
    return {
      OR: [
        scope.districtIds.length ? { districts: { some: { id: { in: scope.districtIds } } } } : undefined,
        scope.ulbIds.length ? { districts: { some: { ulbs: { some: { id: { in: scope.ulbIds } } } } } } : undefined,
        scope.wardIds.length
          ? {
              districts: {
                some: { ulbs: { some: { wards: { some: { id: { in: scope.wardIds } } } } } },
              },
            }
          : undefined,
      ].filter(Boolean) as Prisma.StateWhereInput[],
    }
  }

  async findAll(query: PaginationQueryDto, user: AuthenticatedUser) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where: Prisma.StateWhereInput = {
      AND: [this.scopedWhere(user), query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}],
    }
    const [items, total] = await Promise.all([
      this.prisma.db.state.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "name", "code"], "name"),
      }),
      this.prisma.db.state.count({ where }),
    ])
    return toPaginatedResult(items, total, page, limit)
  }

  async findById(id: string, user: AuthenticatedUser) {
    const item = await this.prisma.db.state.findFirst({
      where: { id, ...this.scopedWhere(user) },
    })
    if (!item) throw new NotFoundException("State not found")
    return item
  }

  create(data: CreateStateDto) {
    return this.prisma.db.state.create({ data })
  }

  async update(id: string, data: UpdateStateDto, user: AuthenticatedUser) {
    await this.findById(id, user)
    return this.prisma.db.state.update({ where: { id }, data })
  }

  async delete(id: string, user: AuthenticatedUser) {
    const scope = resolveTenantScope(user.tenantRoles)
    if (!scope.isGlobal) throw new ForbiddenException("Only global admins can delete states")
    await this.findById(id, user)
    return this.prisma.db.state.delete({ where: { id } })
  }
}
