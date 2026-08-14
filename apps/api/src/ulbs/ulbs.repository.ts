import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { generateUlbApiKey } from "../common/utils/ulb-api-key.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateUlbDto, UpdateUlbDto } from "../states/dto/geo.dto.js"

function isPrismaUniqueConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002"
}

@Injectable()
export class UlbsRepository {
  private readonly logger = new Logger(UlbsRepository.name)

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

  async getCurrentApiKey(ulbId: string, user: AuthenticatedUser) {
    await this.findById(ulbId, user)
    return this.prisma.db.ulbApiKey.findFirst({
      where: { ulbId, isActive: true },
      select: { keyPrefix: true, createdAt: true, isActive: true },
    })
  }

  async rotateApiKey(ulbId: string, user: AuthenticatedUser) {
    await this.findById(ulbId, user)
    const generated = generateUlbApiKey()

    const persist = () =>
      this.prisma.db.$transaction(async (tx) => {
        await tx.ulbApiKey.updateMany({
          where: { ulbId, isActive: true },
          data: { isActive: false, revokedAt: new Date() },
        })
        const created = await tx.ulbApiKey.create({
          data: {
            ulbId,
            keyHash: generated.keyHash,
            keyPrefix: generated.keyPrefix,
            createdById: user.id,
          },
        })
        return {
          rawKey: generated.rawKey,
          keyPrefix: generated.keyPrefix,
          ulbId,
          createdAt: created.createdAt,
        }
      })

    try {
      const result = await persist()
      this.logger.log(`Rotated portal API key for ulb=${ulbId} prefix=${generated.keyPrefix}`)
      return result
    } catch (error) {
      if (!isPrismaUniqueConflict(error)) throw error
      const result = await persist()
      this.logger.log(`Rotated portal API key for ulb=${ulbId} prefix=${generated.keyPrefix} after conflict retry`)
      return result
    }
  }
}
