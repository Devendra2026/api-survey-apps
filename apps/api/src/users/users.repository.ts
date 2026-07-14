import { Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@workspace/database"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { AssignTenantRoleDto, CreateUserDto, UpdateUserDto } from "./dto/user.dto.js"

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: PaginationQueryDto,
    scope?: import("../common/interfaces/authenticated-user.interface.js").TenantScope
  ) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where: Prisma.UserWhereInput = {}
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ]
    }

    if (scope && !scope.isGlobal) {
      const roleOr: Prisma.UserTenantRoleWhereInput[] = []
      if (scope.wardIds.length) roleOr.push({ wardId: { in: scope.wardIds } })
      if (scope.ulbIds.length) roleOr.push({ ulbId: { in: scope.ulbIds } })
      if (scope.districtIds.length) roleOr.push({ districtId: { in: scope.districtIds } })
      if (scope.stateIds.length) roleOr.push({ stateId: { in: scope.stateIds } })
      where.tenantRoles = {
        some: {
          isActive: true,
          ...(roleOr.length ? { OR: roleOr } : { id: "__no_access__" }),
        },
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.db.user.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "fullName", "email", "lastLoginAt"]),
        include: {
          tenantRoles: {
            where: { isActive: true },
            include: { role: true },
          },
        },
      }),
      this.prisma.db.user.count({ where }),
    ])

    return toPaginatedResult(items, total, page, limit)
  }

  async findById(id: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id },
      include: {
        tenantRoles: {
          include: { role: true, state: true, district: true, ulb: true, ward: true },
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
      include: { role: true },
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
