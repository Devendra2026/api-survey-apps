import { Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { AssignTenantRoleDto, CreateUserDto, ListUsersQueryDto, UpdateUserDto } from "./dto/user.dto.js"

const tenantRoleInclude = {
  role: true,
  state: { select: { id: true, name: true, code: true } },
  district: { select: { id: true, name: true } },
  ulb: { select: { id: true, name: true, code: true } },
  ward: { select: { id: true, wardNumber: true, wardName: true } },
} as const

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ListUsersQueryDto,
    scope?: import("../common/interfaces/authenticated-user.interface.js").TenantScope
  ) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where = this.buildListWhere(query, scope)

    const [items, total] = await Promise.all([
      this.prisma.db.user.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "fullName", "email", "lastLoginAt"]),
        include: {
          tenantRoles: {
            where: { isActive: true },
            include: tenantRoleInclude,
          },
        },
      }),
      this.prisma.db.user.count({ where }),
    ])

    return toPaginatedResult(items, total, page, limit)
  }

  async getStats(scope?: import("../common/interfaces/authenticated-user.interface.js").TenantScope) {
    const baseWhere = this.buildListWhere({}, scope)
    const roleNames = ["PENDING_APPROVAL", "SURVEYOR", "FIELD_SUPERVISOR", "QC_SUPERVISOR", "ADMIN"] as const

    const [total, active, disabled, ...roleCounts] = await Promise.all([
      this.prisma.db.user.count({ where: baseWhere }),
      this.prisma.db.user.count({ where: { ...baseWhere, isActive: true } }),
      this.prisma.db.user.count({ where: { ...baseWhere, isActive: false } }),
      ...roleNames.map((roleName) =>
        this.prisma.db.user.count({
          where: {
            ...baseWhere,
            tenantRoles: {
              some: {
                isActive: true,
                role: { name: roleName },
              },
            },
          },
        })
      ),
    ])

    const byRole = Object.fromEntries(roleNames.map((name, i) => [name, roleCounts[i] ?? 0])) as Record<
      (typeof roleNames)[number],
      number
    >

    return {
      total,
      active,
      disabled,
      pending: byRole.PENDING_APPROVAL,
      surveyors: byRole.SURVEYOR,
      supervisors: byRole.FIELD_SUPERVISOR,
      qcSupervisors: byRole.QC_SUPERVISOR,
      admins: byRole.ADMIN,
      byRole,
    }
  }

  async findAuditsForUser(userId: string, take = 50) {
    return this.prisma.db.securityAudit.findMany({
      where: {
        OR: [{ actorId: userId }, { targetId: userId, targetType: { in: ["User", "UserTenantRole"] } }],
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        actor: { select: { id: true, fullName: true, email: true } },
      },
    })
  }

  private buildListWhere(
    query: ListUsersQueryDto,
    scope?: import("../common/interfaces/authenticated-user.interface.js").TenantScope
  ): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {}

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search, mode: "insensitive" } },
      ]
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive
    }

    const roleFilters: Prisma.UserTenantRoleWhereInput[] = []

    if (query.roleName || query.stateId || query.districtId || query.ulbId || query.wardId) {
      const roleWhere: Prisma.UserTenantRoleWhereInput = { isActive: true }
      if (query.roleName) {
        roleWhere.role = { name: query.roleName }
      }
      if (query.stateId) roleWhere.stateId = query.stateId
      if (query.districtId) roleWhere.districtId = query.districtId
      if (query.ulbId) roleWhere.ulbId = query.ulbId
      if (query.wardId) roleWhere.wardId = query.wardId
      roleFilters.push(roleWhere)
    }

    if (scope && !scope.isGlobal) {
      const roleOr: Prisma.UserTenantRoleWhereInput[] = []
      if (scope.wardIds.length) roleOr.push({ wardId: { in: scope.wardIds } })
      if (scope.ulbIds.length) roleOr.push({ ulbId: { in: scope.ulbIds } })
      if (scope.districtIds.length) roleOr.push({ districtId: { in: scope.districtIds } })
      if (scope.stateIds.length) roleOr.push({ stateId: { in: scope.stateIds } })
      roleFilters.push({
        isActive: true,
        ...(roleOr.length ? { OR: roleOr } : { id: "__no_access__" }),
      })
    }

    if (roleFilters.length === 1) {
      where.tenantRoles = { some: roleFilters[0] }
    } else if (roleFilters.length > 1) {
      where.AND = roleFilters.map((f) => ({ tenantRoles: { some: f } }))
    }

    return where
  }

  async findById(id: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id },
      include: {
        tenantRoles: {
          include: tenantRoleInclude,
        },
      },
    })
    if (!user) throw new NotFoundException("User not found")
    return user
  }

  async findByClerkId(clerkUserId: string) {
    return this.prisma.db.user.findUnique({ where: { clerkUserId } })
  }

  async create(data: CreateUserDto) {
    return this.prisma.db.user.create({ data })
  }

  async update(id: string, data: UpdateUserDto) {
    await this.findById(id)
    return this.prisma.db.user.update({ where: { id }, data })
  }

  async assignTenantRole(dto: AssignTenantRoleDto, assignedBy: string) {
    return this.prisma.db.userTenantRole.create({
      data: {
        userId: dto.userId,
        roleId: dto.roleId,
        stateId: dto.stateId,
        districtId: dto.districtId,
        ulbId: dto.ulbId,
        wardId: dto.wardId,
        assignedBy,
      },
      include: tenantRoleInclude,
    })
  }

  async deactivateActiveRolesForUser(userId: string, deactivatedBy: string) {
    return this.prisma.db.userTenantRole.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, deactivatedAt: new Date(), deactivatedBy },
    })
  }

  async deactivateTenantRole(id: string, deactivatedBy: string) {
    return this.prisma.db.userTenantRole.update({
      where: { id },
      data: { isActive: false, deactivatedAt: new Date(), deactivatedBy },
    })
  }

  async softDelete(id: string) {
    await this.findById(id)
    return this.prisma.db.user.update({
      where: { id },
      data: { isActive: false },
    })
  }
}
