import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import { isSystemZeroWard } from "@workspace/validation"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { generateUlbApiKey } from "../common/utils/ulb-api-key.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateUlbDto, UpdateUlbDto } from "../states/dto/geo.dto.js"

const ULB_NAME_CONFLICT = "A ULB with this name already exists in this district."
const ULB_CODE_CONFLICT = "A ULB with this code already exists."

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === code
}

function isPrismaUniqueConflict(error: unknown): boolean {
  return isPrismaCode(error, "P2002")
}

function uniqueTargetIncludes(error: unknown, field: string): boolean {
  if (!isPrismaUniqueConflict(error)) return false
  const target = (error as { meta?: { target?: string[] | string } }).meta?.target
  if (Array.isArray(target)) return target.some((entry) => entry === field || entry.includes(field))
  if (typeof target === "string") return target.includes(field)
  return false
}

function conflictFromUnique(error: unknown): ConflictException {
  if (uniqueTargetIncludes(error, "code")) return new ConflictException(ULB_CODE_CONFLICT)
  return new ConflictException(ULB_NAME_CONFLICT)
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

  /** Same visibility as district lists: global, assigned district, or parent state. */
  private districtScopedWhere(user: AuthenticatedUser): Prisma.DistrictWhereInput {
    const scope = resolveTenantScope(user.tenantRoles)
    if (scope.isGlobal) return {}
    const or: Prisma.DistrictWhereInput[] = []
    if (scope.districtIds.length) or.push({ id: { in: scope.districtIds } })
    if (scope.stateIds.length) or.push({ stateId: { in: scope.stateIds } })
    if (scope.ulbIds.length) or.push({ ulbs: { some: { id: { in: scope.ulbIds } } } })
    if (scope.wardIds.length) or.push({ ulbs: { some: { wards: { some: { id: { in: scope.wardIds } } } } } })
    return or.length ? { OR: or } : { id: "__no_access__" }
  }

  private async assertDistrictAccessible(districtId: string, user: AuthenticatedUser) {
    const district = await this.prisma.db.district.findFirst({
      where: { id: districtId, ...this.districtScopedWhere(user) },
      select: { id: true, stateId: true, state: { select: { id: true } } },
    })
    if (!district?.stateId || !district.state) {
      throw new NotFoundException("District not found")
    }
    return district
  }

  private async assertUniqueName(districtId: string, name: string, excludeId?: string) {
    const existing = await this.prisma.db.ulb.findFirst({
      where: {
        districtId,
        name: { equals: name, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })
    if (existing) throw new ConflictException(ULB_NAME_CONFLICT)
  }

  private async assertUniqueCode(code: string, excludeId?: string) {
    const existing = await this.prisma.db.ulb.findFirst({
      where: {
        code: { equals: code, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })
    if (existing) throw new ConflictException(ULB_CODE_CONFLICT)
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

  async create(data: CreateUlbDto, user: AuthenticatedUser) {
    const name = data.name.trim()
    const code = data.code.trim()
    if (!name || !code) throw new BadRequestException("ULB name and code are required")
    await this.assertDistrictAccessible(data.districtId, user)
    await this.assertUniqueName(data.districtId, name)
    await this.assertUniqueCode(code)
    try {
      return await this.prisma.db.ulb.create({
        data: {
          districtId: data.districtId,
          name,
          code,
          type: data.type,
        },
      })
    } catch (error) {
      if (isPrismaUniqueConflict(error)) throw conflictFromUnique(error)
      throw error
    }
  }

  async update(id: string, data: UpdateUlbDto, user: AuthenticatedUser) {
    const existing = await this.findById(id, user)
    if (data.districtId !== undefined && data.districtId !== existing.districtId) {
      throw new BadRequestException("ULB district cannot be changed")
    }
    const name = data.name !== undefined ? data.name.trim() : undefined
    const code = data.code !== undefined ? data.code.trim() : undefined
    if (name !== undefined && !name) throw new BadRequestException("ULB name is required")
    if (code !== undefined && !code) throw new BadRequestException("ULB code is required")
    if (name !== undefined) await this.assertUniqueName(existing.districtId, name, id)
    if (code !== undefined) await this.assertUniqueCode(code, id)
    try {
      return await this.prisma.db.ulb.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(code !== undefined ? { code } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
        },
      })
    } catch (error) {
      if (isPrismaUniqueConflict(error)) throw conflictFromUnique(error)
      throw error
    }
  }

  async delete(id: string, user: AuthenticatedUser) {
    await this.findById(id, user)
    try {
      return await this.prisma.db.$transaction(async (tx) => {
        const wards = await tx.ward.findMany({
          where: { ulbId: id },
          select: { id: true, kind: true, wardName: true, deletedAt: true },
        })
        const activeGeographic = wards.filter((ward) => ward.deletedAt == null && !isSystemZeroWard(ward))
        if (activeGeographic.length > 0) {
          throw new ConflictException(
            `Cannot delete this ULB — it has ${activeGeographic.length} ward(s). Remove wards first.`
          )
        }
        // Tombstones and the Zero Ward go with the ULB because Ward.ulb is Restrict.
        const removableWardIds = wards
          .filter((ward) => isSystemZeroWard(ward) || ward.deletedAt != null)
          .map((ward) => ward.id)
        const zeroWardIds = wards.filter((ward) => isSystemZeroWard(ward)).map((ward) => ward.id)
        const geographicWardIds = wards.filter((ward) => !isSystemZeroWard(ward)).map((ward) => ward.id)
        const blockingSurveyCount = await tx.survey.count({
          where: {
            OR: [
              ...(geographicWardIds.length > 0 ? [{ wardId: { in: geographicWardIds } }] : []),
              {
                ulbId: id,
                ...(zeroWardIds.length > 0 ? { wardId: { notIn: zeroWardIds } } : {}),
              },
            ],
          },
        })
        if (blockingSurveyCount > 0) {
          throw new ConflictException("Cannot delete this ULB — surveys are linked to it.")
        }
        if (zeroWardIds.length > 0) {
          const quarantineSurveys = await tx.survey.findMany({
            where: { wardId: { in: zeroWardIds } },
            select: { id: true },
          })
          const surveyIds = quarantineSurveys.map((survey) => survey.id)
          if (surveyIds.length > 0) {
            await tx.surveyAudit.deleteMany({ where: { surveyId: { in: surveyIds } } })
            await tx.survey.deleteMany({ where: { id: { in: surveyIds } } })
          }
        }
        await tx.ulbApiKey.deleteMany({ where: { ulbId: id } })
        await tx.userTenantRole.deleteMany({
          where: {
            OR: [{ ulbId: id }, ...(removableWardIds.length > 0 ? [{ wardId: { in: removableWardIds } }] : [])],
          },
        })
        if (removableWardIds.length > 0) {
          await tx.ward.deleteMany({ where: { ulbId: id, id: { in: removableWardIds } } })
        }
        return tx.ulb.delete({ where: { id } })
      })
    } catch (error) {
      if (isPrismaCode(error, "P2003")) {
        throw new ConflictException("Cannot delete this ULB — related records still reference it.")
      }
      throw error
    }
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
