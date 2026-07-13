import { Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateUlbDto, UpdateUlbDto } from "../states/dto/geo.dto.js"

@Injectable()
export class UlbsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private scopedWhere(user: AuthenticatedUser): Prisma.UlbWhereInput {
    const scope = resolveTenantScope(user.tenantRoles)
    if (scope.isGlobal) return {}
    const or: Prisma.UlbWhereInput[] = []
    if (scope.ulbIds.length) or.push({ id: { in: scope.ulbIds } })
    if (scope.districtIds.length) or.push({ districtId: { in: scope.districtIds } })
    if (scope.stateIds.length) or.push({ district: { stateId: { in: scope.stateIds } } })
    if (scope.wardIds.length) or.push({ wards: { some: { id: { in: scope.wardIds } } } })
    return or.length ? { OR: or } : { id: "__no_access__" }
  }

  async findAll(query: PaginationQueryDto, user: AuthenticatedUser, districtId?: string) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where: Prisma.UlbWhereInput = {
      AND: [
        this.scopedWhere(user),
        districtId ? { districtId } : {},
        query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { code: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    }
    const [items, total] = await Promise.all([
      this.prisma.db.ulb.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "name", "code"], "name"),
      }),
      this.prisma.db.ulb.count({ where }),
    ])
    return toPaginatedResult(items, total, page, limit)
  }

  async findById(id: string, user: AuthenticatedUser) {
    const item = await this.prisma.db.ulb.findFirst({
      where: { id, ...this.scopedWhere(user) },
    })
    if (!item) throw new NotFoundException("ULB not found")
    return item
  }

  create(data: CreateUlbDto) {
    return this.prisma.db.ulb.create({ data })
  }

  async update(id: string, data: UpdateUlbDto, user: AuthenticatedUser) {
    await this.findById(id, user)
    return this.prisma.db.ulb.update({ where: { id }, data })
  }

  async delete(id: string, user: AuthenticatedUser) {
    await this.findById(id, user)
    return this.prisma.db.ulb.delete({ where: { id } })
  }
}
