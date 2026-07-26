import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import { normalizeDistrictCode } from "@workspace/validation"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateDistrictDto, UpdateDistrictDto } from "../states/dto/geo.dto.js"

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002"
}

function uniqueTargetIncludesCode(error: unknown): boolean {
  if (!isUniqueViolation(error)) return false
  const target = (error as { meta?: { target?: string[] | string } }).meta?.target
  if (Array.isArray(target)) return target.some((t) => t === "code" || t.includes("code"))
  if (typeof target === "string") return target.includes("code")
  return false
}

@Injectable()
export class DistrictsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private scopedWhere(user: AuthenticatedUser): Prisma.DistrictWhereInput {
    const scope = resolveTenantScope(user.tenantRoles)
    if (scope.isGlobal) return {}
    const or: Prisma.DistrictWhereInput[] = []
    if (scope.districtIds.length) or.push({ id: { in: scope.districtIds } })
    if (scope.stateIds.length) or.push({ stateId: { in: scope.stateIds } })
    if (scope.ulbIds.length) or.push({ ulbs: { some: { id: { in: scope.ulbIds } } } })
    if (scope.wardIds.length) or.push({ ulbs: { some: { wards: { some: { id: { in: scope.wardIds } } } } } })
    return or.length ? { OR: or } : { id: "__no_access__" }
  }

  async findAll(query: PaginationQueryDto, user: AuthenticatedUser, stateId?: string) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where: Prisma.DistrictWhereInput = {
      AND: [
        this.scopedWhere(user),
        stateId ? { stateId } : {},
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
      this.prisma.db.district.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "name", "code"], "name"),
      }),
      this.prisma.db.district.count({ where }),
    ])
    return toPaginatedResult(items, total, page, limit)
  }

  async findById(id: string, user: AuthenticatedUser) {
    const item = await this.prisma.db.district.findFirst({
      where: { id, ...this.scopedWhere(user) },
    })
    if (!item) throw new NotFoundException("District not found")
    return item
  }

  async create(data: CreateDistrictDto) {
    const code = normalizeDistrictCode(data.code)
    try {
      return await this.prisma.db.district.create({
        data: {
          stateId: data.stateId,
          name: data.name,
          code,
        },
      })
    } catch (error) {
      if (uniqueTargetIncludesCode(error)) {
        throw new ConflictException("District code already exists in this state")
      }
      throw error
    }
  }

  async update(id: string, data: UpdateDistrictDto, user: AuthenticatedUser) {
    await this.findById(id, user)
    const payload: Prisma.DistrictUpdateInput = {}
    if (data.name !== undefined) payload.name = data.name
    if (data.stateId !== undefined) {
      payload.state = { connect: { id: data.stateId } }
    }
    if (data.code !== undefined) payload.code = normalizeDistrictCode(data.code)
    try {
      return await this.prisma.db.district.update({ where: { id }, data: payload })
    } catch (error) {
      if (uniqueTargetIncludesCode(error)) {
        throw new ConflictException("District code already exists in this state")
      }
      throw error
    }
  }

  async delete(id: string, user: AuthenticatedUser) {
    await this.findById(id, user)
    return this.prisma.db.district.delete({ where: { id } })
  }
}
