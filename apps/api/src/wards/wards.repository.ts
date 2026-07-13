import { Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateWardDto, UpdateWardDto } from "../states/dto/geo.dto.js"

@Injectable()
export class WardsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private scopedWhere(user: AuthenticatedUser): Prisma.WardWhereInput {
    const scope = resolveTenantScope(user.tenantRoles)
    if (scope.isGlobal) return {}
    const or: Prisma.WardWhereInput[] = []
    if (scope.wardIds.length) or.push({ id: { in: scope.wardIds } })
    if (scope.ulbIds.length) or.push({ ulbId: { in: scope.ulbIds } })
    if (scope.districtIds.length) or.push({ ulb: { districtId: { in: scope.districtIds } } })
    if (scope.stateIds.length) or.push({ ulb: { district: { stateId: { in: scope.stateIds } } } })
    return or.length ? { OR: or } : { id: "__no_access__" }
  }

  async findAll(query: PaginationQueryDto, user: AuthenticatedUser, ulbId?: string) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where: Prisma.WardWhereInput = {
      AND: [
        this.scopedWhere(user),
        ulbId ? { ulbId } : {},
        query.search
          ? {
              OR: [
                { wardName: { contains: query.search, mode: "insensitive" } },
                { wardNumber: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    }
    const [items, total] = await Promise.all([
      this.prisma.db.ward.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "wardName", "wardNumber"], "wardNumber"),
      }),
      this.prisma.db.ward.count({ where }),
    ])
    return toPaginatedResult(items, total, page, limit)
  }

  async findById(id: string, user: AuthenticatedUser) {
    const item = await this.prisma.db.ward.findFirst({
      where: { id, ...this.scopedWhere(user) },
    })
    if (!item) throw new NotFoundException("Ward not found")
    return item
  }

  create(data: CreateWardDto) {
    return this.prisma.db.ward.create({ data })
  }

  async update(id: string, data: UpdateWardDto, user: AuthenticatedUser) {
    await this.findById(id, user)
    return this.prisma.db.ward.update({ where: { id }, data })
  }

  async delete(id: string, user: AuthenticatedUser) {
    await this.findById(id, user)
    return this.prisma.db.ward.delete({ where: { id } })
  }
}
