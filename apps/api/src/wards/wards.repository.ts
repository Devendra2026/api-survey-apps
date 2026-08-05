import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import { normalizeWardNumber } from "@workspace/validation"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateWardDto, UpdateWardDto } from "../states/dto/geo.dto.js"

const WARD_NAME_CONFLICT = "A ward with this name already exists. Please use a different name."
const WARD_NUMBER_CONFLICT = "A ward with this number already exists in this ULB"
const WARD_CODE_CONFLICT = "A ward with this code already exists in this ULB"

function isPrismaUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002"
}

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

  private activeWhere(): Prisma.WardWhereInput {
    return { deletedAt: null }
  }

  private async assertUniqueActiveWardName(ulbId: string, wardName: string, excludeWardId?: string): Promise<void> {
    const existing = await this.prisma.db.ward.findFirst({
      where: {
        ulbId,
        deletedAt: null,
        wardName: { equals: wardName.trim(), mode: "insensitive" },
        ...(excludeWardId ? { id: { not: excludeWardId } } : {}),
      },
      select: { id: true },
    })
    if (existing) {
      throw new ConflictException(WARD_NAME_CONFLICT)
    }
  }

  /** Rejects another active ward whose normalized number matches (e.g. "01" vs "1"). */
  private async assertUniqueNormalizedWardNumber(
    ulbId: string,
    wardNumber: string,
    excludeWardId?: string
  ): Promise<void> {
    const canonical = normalizeWardNumber(wardNumber)
    const active = await this.prisma.db.ward.findMany({
      where: {
        ulbId,
        deletedAt: null,
        ...(excludeWardId ? { id: { not: excludeWardId } } : {}),
      },
      select: { id: true, wardNumber: true },
    })
    const clash = active.find((w) => normalizeWardNumber(w.wardNumber) === canonical)
    if (clash) {
      throw new ConflictException(WARD_NUMBER_CONFLICT)
    }
  }

  async findAll(query: PaginationQueryDto, user: AuthenticatedUser, ulbId?: string) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where: Prisma.WardWhereInput = {
      AND: [
        this.activeWhere(),
        this.scopedWhere(user),
        ulbId ? { ulbId } : {},
        query.search
          ? {
              OR: [
                { wardName: { contains: query.search, mode: "insensitive" } },
                { wardNumber: { contains: query.search, mode: "insensitive" } },
                { wardCode: { contains: query.search, mode: "insensitive" } },
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
      where: { id, ...this.activeWhere(), ...this.scopedWhere(user) },
    })
    if (!item) throw new NotFoundException("Ward not found")
    return item
  }

  async create(data: CreateWardDto) {
    const wardNumber = normalizeWardNumber(data.wardNumber)
    const wardName = data.wardName.trim()
    const wardCode = data.wardCode?.trim().toUpperCase() || undefined
    await this.assertUniqueActiveWardName(data.ulbId, wardName)
    await this.assertUniqueNormalizedWardNumber(data.ulbId, wardNumber)
    try {
      return await this.prisma.db.ward.create({
        data: {
          ulbId: data.ulbId,
          wardNumber,
          wardName,
          ...(wardCode ? { wardCode } : {}),
        },
      })
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        const target = (error as { meta?: { target?: string[] } }).meta?.target
        if (target?.includes("wardCode")) {
          throw new ConflictException(WARD_CODE_CONFLICT)
        }
        throw new ConflictException(WARD_NUMBER_CONFLICT)
      }
      throw error
    }
  }

  async update(id: string, data: UpdateWardDto, user: AuthenticatedUser) {
    const existing = await this.findById(id, user)
    if (data.wardName !== undefined) {
      await this.assertUniqueActiveWardName(existing.ulbId, data.wardName, id)
    }
    const wardNumber = data.wardNumber !== undefined ? normalizeWardNumber(data.wardNumber) : undefined
    if (wardNumber !== undefined) {
      await this.assertUniqueNormalizedWardNumber(existing.ulbId, wardNumber, id)
    }
    const wardCode =
      data.wardCode !== undefined ? (data.wardCode.trim() ? data.wardCode.trim().toUpperCase() : null) : undefined
    try {
      return await this.prisma.db.ward.update({
        where: { id },
        data: {
          ...(data.ulbId !== undefined ? { ulbId: data.ulbId } : {}),
          ...(wardNumber !== undefined ? { wardNumber } : {}),
          ...(data.wardName !== undefined ? { wardName: data.wardName.trim() } : {}),
          ...(wardCode !== undefined ? { wardCode } : {}),
        },
      })
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        const target = (error as { meta?: { target?: string[] } }).meta?.target
        if (target?.includes("wardCode")) {
          throw new ConflictException(WARD_CODE_CONFLICT)
        }
        throw new ConflictException(WARD_NUMBER_CONFLICT)
      }
      throw error
    }
  }

  async delete(id: string, user: AuthenticatedUser) {
    await this.findById(id, user)
    return this.prisma.db.ward.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
}
