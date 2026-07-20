import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import {
  canAccessTenant,
  canGrantRole,
  resolveTenantScope,
  userHasPermissionInTenant,
} from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type {
  AssignTenantRoleDto,
  CreateUserDto,
  ListUsersQueryDto,
  SyncUserDto,
  UpdateUserDto,
} from "./dto/user.dto.js"
import { UsersRepository } from "./users.repository.js"

const ROLES_REQUIRING_FULL_GEO = new Set(["SURVEYOR", "FIELD_SUPERVISOR"])
const ROLES_REQUIRING_GLOBAL = new Set(["ADMIN", "PENDING_APPROVAL"])

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService
  ) {}

  findAll(query: ListUsersQueryDto, actor: AuthenticatedUser) {
    const scope = resolveTenantScope(actor.tenantRoles)
    return this.usersRepository.findAll(query, scope)
  }

  getStats(actor: AuthenticatedUser) {
    const scope = resolveTenantScope(actor.tenantRoles)
    return this.usersRepository.getStats(scope)
  }

  async getAudits(userId: string, actor: AuthenticatedUser) {
    await this.findById(userId, actor)
    return this.usersRepository.findAuditsForUser(userId)
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
    if (dto.isActive === false && id === actor.id) {
      throw new ForbiddenException("You cannot disable your own account")
    }
    await this.findById(id, actor)
    return this.usersRepository.update(id, dto)
  }

  async assignTenantRole(dto: AssignTenantRoleDto, actor: AuthenticatedUser) {
    const actorScope = resolveTenantScope(actor.tenantRoles)

    const role = await this.prisma.db.role.findUnique({ where: { id: dto.roleId } })
    if (!role) throw new NotFoundException("Role not found")

    // Normalize geo based on role rules
    let stateId = dto.stateId
    let districtId = dto.districtId
    let ulbId = dto.ulbId
    let wardId = dto.wardId

    if (ROLES_REQUIRING_GLOBAL.has(role.name)) {
      stateId = undefined
      districtId = undefined
      ulbId = undefined
      wardId = undefined
    }

    if (ROLES_REQUIRING_FULL_GEO.has(role.name)) {
      if (!stateId || !districtId || !ulbId || !wardId) {
        throw new BadRequestException(
          `${role.name === "FIELD_SUPERVISOR" ? "Supervisor" : "Surveyor"} assignments require State, District, ULB, and Ward`
        )
      }
    }

    const isGlobalAssignment = !stateId && !districtId && !ulbId && !wardId
    const geo = {
      stateId,
      districtId,
      ulbId,
      wardId,
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

    const actorRoleNames = actor.tenantRoles.filter((r) => r.isActive).map((r) => r.roleName)
    if (!canGrantRole(actorRoleNames, role.name)) {
      throw new ForbiddenException(`Your role cannot grant ${role.name}`)
    }

    const target = await this.usersRepository.findById(dto.userId)
    if (!this.canViewUser(actor, target)) {
      throw new ForbiddenException("Cannot assign roles to users outside your tenant scope")
    }

    // Single active assignment model: deactivate prior roles before creating the new one
    await this.usersRepository.deactivateActiveRolesForUser(dto.userId, actor.id)

    const normalizedDto: AssignTenantRoleDto = {
      userId: dto.userId,
      roleId: dto.roleId,
      stateId,
      districtId,
      ulbId,
      wardId,
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

    this.logger.log(`Role assignment user=${dto.userId} role=${role.name} by=${actor.id}`)
    return this.usersRepository.assignTenantRole(normalizedDto, actor.id)
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
