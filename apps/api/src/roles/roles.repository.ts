import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import { buildOrderBy, getSkipTake, toPaginatedResult } from "../common/utils/pagination.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type {
  AssignPermissionDto,
  CloneRoleDto,
  CreateRoleDto,
  SetRolePermissionsDto,
  UpdateRoleDto,
} from "./dto/role.dto.js"
import { validateViewDependencies } from "./permission-dependency.js"
import { isSystemRole, SYSTEM_ROLE_NAMES, validatePermissionChange } from "./system-role-policy.js"

export { SYSTEM_ROLE_NAMES }

type SecurityAuditActor = {
  id: string
  fullName: string
  email: string
}

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const { skip, take, page, limit } = getSkipTake(query)
    const where = query.search ? { name: { contains: query.search, mode: "insensitive" as const } } : {}

    const [rows, total] = await Promise.all([
      this.prisma.db.role.findMany({
        where,
        skip,
        take,
        orderBy: buildOrderBy(query.sortBy, query.sortOrder, ["createdAt", "name"], "name"),
        include: {
          permissions: { include: { permission: true } },
          _count: {
            select: {
              permissions: true,
              userTenantRoles: { where: { isActive: true } },
            },
          },
        },
      }),
      this.prisma.db.role.count({ where }),
    ])

    const items = rows.map(({ _count, ...role }) => ({
      ...role,
      permissionCount: _count.permissions,
      assignedUsersCount: _count.userTenantRoles,
    }))

    return toPaginatedResult(items, total, page, limit)
  }

  async findById(id: string) {
    const role = await this.prisma.db.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: {
          select: {
            permissions: true,
            userTenantRoles: { where: { isActive: true } },
          },
        },
      },
    })
    if (!role) throw new NotFoundException("Role not found")
    const { _count, ...rest } = role
    return {
      ...rest,
      permissionCount: _count.permissions,
      assignedUsersCount: _count.userTenantRoles,
    }
  }

  async create(data: CreateRoleDto) {
    try {
      return await this.prisma.db.role.create({ data })
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException("A role with this name already exists")
      }
      throw error
    }
  }

  async update(id: string, data: UpdateRoleDto) {
    const role = await this.findById(id)
    if (isSystemRole(role.name) && data.name && data.name !== role.name) {
      throw new BadRequestException("System role names cannot be renamed")
    }
    try {
      return await this.prisma.db.role.update({ where: { id }, data })
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException("A role with this name already exists")
      }
      throw error
    }
  }

  async delete(id: string) {
    const role = await this.findById(id)
    if (isSystemRole(role.name)) {
      throw new BadRequestException("System roles cannot be deleted")
    }
    const assignments = await this.prisma.db.userTenantRole.count({
      where: { roleId: id, isActive: true },
    })
    if (assignments > 0) {
      throw new BadRequestException("Cannot delete a role with active user assignments")
    }
    await this.prisma.db.rolePermission.deleteMany({ where: { roleId: id } })
    return this.prisma.db.role.delete({ where: { id } })
  }

  async assignPermission(dto: AssignPermissionDto) {
    await this.findById(dto.roleId)
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
    await this.findById(roleId)
    try {
      return await this.prisma.db.rolePermission.delete({
        where: { roleId_permissionId: { roleId, permissionId } },
      })
    } catch {
      throw new NotFoundException("Permission assignment not found")
    }
  }

  /**
   * Replace role permissions with a validated set inside a single transaction,
   * including security audit. All roles (including system) accept full edits.
   */
  async setPermissions(roleId: string, dto: SetRolePermissionsDto, actor: SecurityAuditActor) {
    const before = await this.findById(roleId)

    const uniqueIds = [...new Set(dto.permissionIds)]
    if (uniqueIds.length === 0) {
      throw new BadRequestException("At least one permission is required")
    }

    const permissions = await this.prisma.db.permission.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true },
    })
    if (permissions.length !== uniqueIds.length) {
      throw new BadRequestException("One or more permission IDs are invalid")
    }

    const nextNameSet = new Set(permissions.map((p) => p.name))
    const policyError = validatePermissionChange(before.name, nextNameSet)
    if (policyError) {
      throw new BadRequestException(policyError)
    }

    const allCatalog = await this.prisma.db.permission.findMany({ select: { name: true } })
    const catalogNames = new Set(allCatalog.map((p) => p.name))
    const nextNames = permissions.map((p) => p.name).sort()
    const dependencyError = validateViewDependencies(nextNames, catalogNames)
    if (dependencyError) {
      throw new BadRequestException(dependencyError)
    }

    const previousIds = before.permissions.map((p) => p.permissionId).sort()
    const previousNames = before.permissions.map((p) => p.permission.name).sort()
    const nextIds = uniqueIds.slice().sort()
    const previousIdSet = new Set(previousIds)
    const nextIdSet = new Set(nextIds)
    const toAdd = nextIds.filter((id) => !previousIdSet.has(id))
    const toRemove = previousIds.filter((id) => !nextIdSet.has(id))
    const addedNames = nextNames.filter((n) => !previousNames.includes(n))
    const removedNames = previousNames.filter((n) => !nextNames.includes(n))

    await this.prisma.db.$transaction(async (tx) => {
      if (toRemove.length) {
        await tx.rolePermission.deleteMany({
          where: { roleId, permissionId: { in: toRemove } },
        })
      }
      if (toAdd.length) {
        await tx.rolePermission.createMany({
          data: toAdd.map((permissionId) => ({ roleId, permissionId })),
        })
      }
      await tx.securityAudit.create({
        data: {
          action: "ROLE_PERMISSIONS_UPDATED",
          actorId: actor.id,
          targetType: "Role",
          targetId: roleId,
          oldValue: {
            roleName: before.name,
            permissionIds: previousIds,
            permissionNames: previousNames,
          },
          newValue: {
            roleName: before.name,
            permissionIds: nextIds,
            permissionNames: nextNames,
            added: addedNames,
            removed: removedNames,
          },
          metadata: {
            adminName: actor.fullName,
            adminEmail: actor.email,
            changedAt: new Date().toISOString(),
          },
        },
      })
    })

    return this.findById(roleId)
  }

  async clone(sourceId: string, dto: CloneRoleDto) {
    const source = await this.findById(sourceId)
    const existing = await this.prisma.db.role.findUnique({ where: { name: dto.name } })
    if (existing) throw new ConflictException("A role with this name already exists")

    return this.prisma.db.role.create({
      data: {
        name: dto.name,
        description: dto.description ?? source.description,
        permissions: {
          create: source.permissions.map((p) => ({ permissionId: p.permissionId })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    })
  }

  async listAudits(roleId: string) {
    await this.findById(roleId)
    return this.prisma.db.securityAudit.findMany({
      where: { targetType: "Role", targetId: roleId, action: "ROLE_PERMISSIONS_UPDATED" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        actor: {
          select: { id: true, fullName: true, email: true },
        },
      },
    })
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002"
    )
  }
}
