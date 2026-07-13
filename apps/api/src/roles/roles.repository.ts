import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { AssignPermissionDto, CreateRoleDto, UpdateRoleDto } from "./dto/role.dto.js"

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where = query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}

    const [items, total] = await Promise.all([
      this.prisma.db.role.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "name"], "name"),
        include: { permissions: { include: { permission: true } } },
      }),
      this.prisma.db.role.count({ where }),
    ])
    return toPaginatedResult(items, total, page, limit)
  }

  async findById(id: string) {
    const role = await this.prisma.db.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    })
    if (!role) throw new NotFoundException("Role not found")
    return role
  }

  create(data: CreateRoleDto) {
    return this.prisma.db.role.create({ data })
  }

  async update(id: string, data: UpdateRoleDto) {
    await this.findById(id)
    return this.prisma.db.role.update({ where: { id }, data })
  }

  async delete(id: string) {
    await this.findById(id)
    return this.prisma.db.role.delete({ where: { id } })
  }

  async assignPermission(dto: AssignPermissionDto) {
    try {
      return await this.prisma.db.rolePermission.create({
        data: { roleId: dto.roleId, permissionId: dto.permissionId },
        include: { permission: true, role: true },
      })
    } catch {
      throw new ConflictException("Permission already assigned to role")
    }
  }

  async removePermission(roleId: string, permissionId: string) {
    return this.prisma.db.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId } },
    })
  }
}
