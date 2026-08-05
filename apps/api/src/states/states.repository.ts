import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateStateDto, UpdateStateDto } from "./dto/geo.dto.js"

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002"
}

/** State.code is the only unique field — any P2002 on state write is a code conflict. */
function isStateCodeConflict(error: unknown): boolean {
  if (!isUniqueViolation(error)) return false
  const target = (error as { meta?: { target?: string[] | string } }).meta?.target
  if (target === undefined || target === null) return true
  if (Array.isArray(target)) return target.length === 0 || target.some((t) => t === "code" || t.includes("code"))
  if (typeof target === "string") return target.includes("code") || target.length === 0
  return true
}

const STATE_CODE_CONFLICT =
  "State code already exists. Use the existing state in the hierarchy, or choose a different code."

@Injectable()
export class StatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private scopedWhere(user: AuthenticatedUser): Prisma.StateWhereInput {
    const scope = resolveTenantScope(user.tenantRoles)
    if (scope.isGlobal) return {}
    if (scope.stateIds.length) return { id: { in: scope.stateIds } }
    // Lower-level scopes: discover states via related assignments
    const or: Prisma.StateWhereInput[] = [
      scope.districtIds.length ? { districts: { some: { id: { in: scope.districtIds } } } } : undefined,
      scope.ulbIds.length ? { districts: { some: { ulbs: { some: { id: { in: scope.ulbIds } } } } } } : undefined,
      scope.wardIds.length
        ? {
            districts: {
              some: { ulbs: { some: { wards: { some: { id: { in: scope.wardIds } } } } } },
            },
          }
        : undefined,
    ].filter(Boolean) as Prisma.StateWhereInput[]
    return or.length ? { OR: or } : { id: "__no_access__" }
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

  /** Lookup by unique code (not tenant-scoped) — used for create conflict checks. */
  findByCode(code: string) {
    return this.prisma.db.state.findUnique({ where: { code } })
  }

  async create(data: CreateStateDto) {
    try {
      return await this.prisma.db.state.create({ data })
    } catch (error) {
      if (isStateCodeConflict(error)) {
        throw new ConflictException(STATE_CODE_CONFLICT)
      }
      throw error
    }
  }

  /**
   * Non-global creators only see states in their tenant roles. Attach a
   * state-scoped assignment so GET /states includes the state they just created.
   */
  async ensureCreatorStateAccess(user: AuthenticatedUser, stateId: string) {
    const scope = resolveTenantScope(user.tenantRoles)
    if (scope.isGlobal) return
    if (scope.stateIds.includes(stateId)) return

    const source = user.tenantRoles.find((r) => r.isActive && r.roleName !== "PENDING_APPROVAL")
    if (!source) return

    const existing = await this.prisma.db.userTenantRole.findFirst({
      where: {
        userId: user.id,
        roleId: source.roleId,
        stateId,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
      select: { id: true },
    })
    if (existing) return

    await this.prisma.db.userTenantRole.create({
      data: {
        userId: user.id,
        roleId: source.roleId,
        stateId,
        assignedBy: user.id,
      },
    })
  }

  async update(id: string, data: UpdateStateDto, user: AuthenticatedUser) {
    await this.findById(id, user)
    try {
      return await this.prisma.db.state.update({ where: { id }, data })
    } catch (error) {
      if (isStateCodeConflict(error)) {
        throw new ConflictException(STATE_CODE_CONFLICT)
      }
      throw error
    }
  }

  async delete(id: string, user: AuthenticatedUser) {
    const scope = resolveTenantScope(user.tenantRoles)
    if (!scope.isGlobal) throw new ForbiddenException("Only global admins can delete states")
    await this.findById(id, user)
    return this.prisma.db.state.delete({ where: { id } })
  }
}
