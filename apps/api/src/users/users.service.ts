import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import type { PaginationQueryDto } from "../common/dto/pagination-query.dto.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import {
  canAccessTenant,
  canGrantRole,
  resolveTenantScope,
  userHasPermissionInTenant,
} from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { AssignTenantRoleDto, CreateUserDto, SyncUserDto, UpdateUserDto } from "./dto/user.dto.js"
import { UsersRepository } from "./users.repository.js"

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService
  ) {}

  findAll(query: PaginationQueryDto, actor: AuthenticatedUser) {
    const scope = resolveTenantScope(actor.tenantRoles)
    return this.usersRepository.findAll(query, scope)
  }

  async findById(id: string, actor: AuthenticatedUser) {
    const user = await this.usersRepository.findById(id)
    if (!this.canViewUser(actor, user)) {
      throw new ForbiddenException("Cannot view user outside your tenant scope")
    }
    return user
  }

  getMe(user: AuthenticatedUser) {
    // Keep repository tenantRoles (nested `role`) for the web client.
    // Auth-context assignments use flat `roleName` and would break UI bindings.
    return this.usersRepository.findById(user.id).then((profile) => ({
      ...profile,
      permissions: user.permissions,
    }))
  }

  async sync(user: AuthenticatedUser, dto: SyncUserDto) {
    this.logger.log(`User sync ${user.clerkUserId}`)
    return this.usersRepository.update(user.id, {
      fullName: dto.fullName,
      phone: dto.phone,
    })
  }

  create(dto: CreateUserDto) {
    return this.usersRepository.create(dto)
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    await this.findById(id, actor)
    return this.usersRepository.update(id, dto)
  }

  async assignTenantRole(dto: AssignTenantRoleDto, actor: AuthenticatedUser) {
    const actorScope = resolveTenantScope(actor.tenantRoles)
    const isGlobalAssignment = !dto.stateId && !dto.districtId && !dto.ulbId && !dto.wardId
    const geo = {
      stateId: dto.stateId,
      districtId: dto.districtId,
      ulbId: dto.ulbId,
      wardId: dto.wardId,
    }

    if (!actorScope.isGlobal && !userHasPermissionInTenant(actor, "role:assign", isGlobalAssignment ? {} : geo)) {
      throw new ForbiddenException("Missing permission role:assign in this tenant scope")
    }

    if (isGlobalAssignment && !actorScope.isGlobal) {
      throw new ForbiddenException("Only global admins can assign roles without tenant scope")
    }

    if (!isGlobalAssignment && !canAccessTenant(actorScope, geo)) {
      throw new ForbiddenException("Cannot assign roles outside your tenant scope")
    }

    await this.assertGeoHierarchy(geo)

    const role = await this.prisma.db.role.findUnique({ where: { id: dto.roleId } })
    if (!role) throw new NotFoundException("Role not found")

    const actorRoleNames = actor.tenantRoles.filter((r) => r.isActive).map((r) => r.roleName)
    if (!actorScope.isGlobal && !canGrantRole(actorRoleNames, role.name)) {
      throw new ForbiddenException(`Your role cannot grant ${role.name}`)
    }

    await this.prisma.db.securityAudit.create({
      data: {
        action: "ROLE_ASSIGNED",
        actorId: actor.id,
        targetType: "UserTenantRole",
        targetId: dto.userId,
        newValue: {
          roleId: dto.roleId,
          roleName: role.name,
          ...geo,
        },
      },
    })

    this.logger.log(`Role assignment user=${dto.userId} role=${dto.roleId} by=${actor.id}`)
    return this.usersRepository.assignTenantRole(dto, actor.id)
  }

  async deactivateTenantRole(id: string, actor: AuthenticatedUser) {
    const assignment = await this.prisma.db.userTenantRole.findUnique({
      where: { id },
      include: { role: true },
    })
    if (!assignment) throw new NotFoundException("Role assignment not found")

    const geo = {
      stateId: assignment.stateId,
      districtId: assignment.districtId,
      ulbId: assignment.ulbId,
      wardId: assignment.wardId,
    }
    const scope = resolveTenantScope(actor.tenantRoles)
    if (!scope.isGlobal && !canAccessTenant(scope, geo)) {
      throw new ForbiddenException("Cannot deactivate role assignment outside your tenant scope")
    }

    await this.prisma.db.securityAudit.create({
      data: {
        action: "ROLE_DEACTIVATED",
        actorId: actor.id,
        targetType: "UserTenantRole",
        targetId: id,
        oldValue: { roleId: assignment.roleId, ...geo, isActive: true },
        newValue: { isActive: false },
      },
    })

    return this.usersRepository.deactivateTenantRole(id, actor.id)
  }

  async remove(id: string, actor: AuthenticatedUser) {
    if (id === actor.id) {
      throw new ForbiddenException("You cannot deactivate your own account")
    }
    await this.findById(id, actor)
    this.logger.log(`User soft-delete ${id} by ${actor.id}`)
    return this.usersRepository.softDelete(id)
  }

  private canViewUser(
    actor: AuthenticatedUser,
    target: {
      tenantRoles: Array<{
        isActive: boolean
        stateId: string | null
        districtId: string | null
        ulbId: string | null
        wardId: string | null
      }>
    }
  ) {
    const scope = resolveTenantScope(actor.tenantRoles)
    if (scope.isGlobal) return true
    return target.tenantRoles.some(
      (r) =>
        r.isActive &&
        canAccessTenant(scope, {
          stateId: r.stateId,
          districtId: r.districtId,
          ulbId: r.ulbId,
          wardId: r.wardId,
        })
    )
  }

  private async assertGeoHierarchy(geo: {
    stateId?: string | null
    districtId?: string | null
    ulbId?: string | null
    wardId?: string | null
  }) {
    if (geo.wardId) {
      const ward = await this.prisma.db.ward.findUnique({
        where: { id: geo.wardId },
        include: { ulb: { include: { district: true } } },
      })
      if (!ward) throw new NotFoundException("Invalid wardId")
      if (geo.ulbId && ward.ulbId !== geo.ulbId) {
        throw new ForbiddenException("wardId does not belong to ulbId")
      }
      if (geo.districtId && ward.ulb.districtId !== geo.districtId) {
        throw new ForbiddenException("ulbId does not belong to districtId")
      }
      if (geo.stateId && ward.ulb.district.stateId !== geo.stateId) {
        throw new ForbiddenException("districtId does not belong to stateId")
      }
      return
    }
    if (geo.ulbId) {
      const ulb = await this.prisma.db.ulb.findUnique({
        where: { id: geo.ulbId },
        include: { district: true },
      })
      if (!ulb) throw new NotFoundException("Invalid ulbId")
      if (geo.districtId && ulb.districtId !== geo.districtId) {
        throw new ForbiddenException("ulbId does not belong to districtId")
      }
      if (geo.stateId && ulb.district.stateId !== geo.stateId) {
        throw new ForbiddenException("districtId does not belong to stateId")
      }
    }
  }
}
