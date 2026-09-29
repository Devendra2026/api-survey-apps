import { createClerkClient } from "@clerk/backend"
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PERMISSIONS } from "../common/constants/permissions.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import {
  canAccessTenant,
  canGrantRole,
  isDepartmentRole,
  resolveTenantScope,
  userHasPermissionInTenant,
} from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { ClerkUserSyncService } from "./clerk-user-sync.service.js"
import type {
  AssignTenantRoleDto,
  CreateUserDto,
  ListUsersQueryDto,
  SyncUserDto,
  UpdateUserDto,
} from "./dto/user.dto.js"
import {
  FieldAllotmentValidationError,
  normalizeAllotmentWardId,
  validateFieldAllotments,
  type FieldAllotmentGeo,
} from "./field-allotments.util.js"
import { isPendingClerkUserId } from "./pending-clerk-id.util.js"
import { UserImportService } from "./user-import.service.js"
import { UsersRepository } from "./users.repository.js"

const ROLES_REQUIRING_FULL_GEO = new Set(["SURVEYOR", "FIELD_SUPERVISOR", "QC_SUPERVISOR"])
const ROLES_REQUIRING_GLOBAL = new Set(["ADMIN", "PENDING_APPROVAL"])
const ROLES_REQUIRING_ULB = new Set(["DEPT_ADMIN", "DEPT_CLERK", "DEPT_OPERATOR"])

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly clerkUserSync: ClerkUserSyncService,
    private readonly userImport: UserImportService,
    private readonly configService: ConfigService
  ) {}

  findAll(query: ListUsersQueryDto, actor: AuthenticatedUser) {
    const scope = resolveTenantScope(actor.tenantRoles)
    return this.usersRepository.findAll(query, scope, {
      includePendingForAssign: actor.permissions.includes(PERMISSIONS.ROLE_ASSIGN),
    })
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

  async findByIdWithAuthProviders(id: string, actor: AuthenticatedUser) {
    const user = await this.findById(id, actor)
    const authProviders = await this.resolveAuthProviders(user.clerkUserId)
    return { ...user, authProviders }
  }

  /**
   * Best-effort Clerk identity providers for admin detail.
   * Returns ["unknown"] when the Clerk user is gone or the API cannot be reached.
   */
  private async resolveAuthProviders(clerkUserId: string): Promise<string[]> {
    if (isPendingClerkUserId(clerkUserId)) {
      return ["email"]
    }
    const secretKey = this.configService.get<string>("CLERK_SECRET_KEY")
    if (!secretKey) {
      return ["unknown"]
    }
    try {
      const clerk = createClerkClient({ secretKey })
      const clerkUser = await clerk.users.getUser(clerkUserId)
      const providers = new Set<string>()
      for (const account of clerkUser.externalAccounts ?? []) {
        const provider = account.provider?.replace(/^oauth_/, "")?.trim()
        if (provider) providers.add(provider)
      }
      // Email in Clerk is a contact attribute; passwordEnabled means password sign-in works.
      if (clerkUser.passwordEnabled) {
        providers.add("email")
      }
      if (providers.size === 0) {
        return ["unknown"]
      }
      return [...providers].sort()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const status = typeof err === "object" && err !== null && "status" in err ? Number(err.status) : undefined
      if (status === 404 || /not found/i.test(message)) {
        return ["unknown"]
      }
      this.logger.warn(`Failed to resolve auth providers for ${clerkUserId}: ${message}`)
      return ["unknown"]
    }
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
    const patch: {
      fullName?: string
      phone?: string
      requestedRole?: string
    } = {}

    if (dto.fullName !== undefined) {
      patch.fullName = dto.fullName
    }
    if (dto.phone !== undefined) {
      patch.phone = dto.phone
    }

    // Signup intent only while waiting for Admin onboarding. Never overwrite after a working role.
    if (dto.requestedRole !== undefined) {
      if (this.canSetRequestedRole(user)) {
        patch.requestedRole = dto.requestedRole
      } else {
        this.logger.log(`User sync ignored requestedRole for onboarded user ${user.clerkUserId}`)
      }
    }

    return this.usersRepository.update(user.id, patch)
  }

  /** True when the user has no working permissions (PENDING_APPROVAL / empty). */
  private canSetRequestedRole(user: AuthenticatedUser): boolean {
    if (user.permissions.length > 0) {
      return false
    }
    const active = user.tenantRoles.filter((r) => r.isActive)
    if (active.length === 0) {
      return true
    }
    return active.every((r) => r.roleName === "PENDING_APPROVAL")
  }

  syncFromClerk() {
    return this.clerkUserSync.syncFromClerk()
  }

  getImportTemplateCsv() {
    return this.userImport.getTemplateCsv()
  }

  importUsers(file: Express.Multer.File, actor: AuthenticatedUser, options: { dryRun: boolean }) {
    return this.userImport.importFile(file, actor, options)
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

    const target = await this.usersRepository.findById(dto.userId)
    if (!this.canViewUser(actor, target)) {
      throw new ForbiddenException("Cannot assign roles to users outside your tenant scope")
    }

    const actorRoleNames = actor.tenantRoles.filter((r) => r.isActive).map((r) => r.roleName)
    if (!canGrantRole(actorRoleNames, role.name)) {
      throw new ForbiddenException(`Your role cannot grant ${role.name}`)
    }

    // Field roles: ULB allotments; ward optional (null = All Wards). QC = one ULB.
    if (ROLES_REQUIRING_FULL_GEO.has(role.name)) {
      const allotments = this.normalizeFieldAllotments(dto)
      try {
        validateFieldAllotments(role.name, allotments)
      } catch (err) {
        if (err instanceof FieldAllotmentValidationError) {
          throw new BadRequestException(err.message)
        }
        throw err
      }

      for (const geo of allotments) {
        if (!actorScope.isGlobal && !userHasPermissionInTenant(actor, "role:assign", geo)) {
          throw new ForbiddenException("Missing permission role:assign in this tenant scope")
        }
        if (!actorScope.isGlobal && !canAccessTenant(actorScope, geo)) {
          throw new ForbiddenException("Cannot assign roles outside your tenant scope")
        }
        await this.assertGeoHierarchy(geo)
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
            allotments,
          },
        },
      })

      this.logger.log(
        `Role assignment user=${dto.userId} role=${role.name} allotments=${allotments.length} by=${actor.id}`
      )
      const created = await this.usersRepository.replaceActiveTenantRoles(dto.userId, dto.roleId, allotments, actor.id)
      return created.length === 1 ? created[0] : created
    }

    // Normalize geo based on role rules (single assignment)
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

    if (ROLES_REQUIRING_ULB.has(role.name)) {
      if (!ulbId) {
        throw new BadRequestException("Department roles require a ULB (municipal client)")
      }
      const ulb = await this.prisma.db.ulb.findUnique({
        where: { id: ulbId },
        include: { district: true },
      })
      if (!ulb) throw new NotFoundException("Invalid ulbId")
      // Department roles are ULB-scoped (client); derive parent geo, no ward
      stateId = ulb.district.stateId
      districtId = ulb.districtId
      wardId = undefined
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

    // Legacy DEPT_* grants are rejected by canGrantRole (no longer assignable).
    if (isDepartmentRole(role.name) && !actorScope.isGlobal) {
      const actorDeptUlbs = actor.tenantRoles
        .filter((r) => r.isActive && isDepartmentRole(r.roleName) && r.ulbId)
        .map((r) => r.ulbId as string)
      if (ulbId && actorDeptUlbs.length && !actorDeptUlbs.includes(ulbId)) {
        throw new ForbiddenException("Cannot assign department roles outside your ULB")
      }
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

  private normalizeFieldAllotments(dto: AssignTenantRoleDto): FieldAllotmentGeo[] {
    if (dto.allotments?.length) {
      return dto.allotments.map((a) => ({
        stateId: a.stateId,
        districtId: a.districtId,
        ulbId: a.ulbId,
        wardId: normalizeAllotmentWardId(a.wardId),
      }))
    }
    if (dto.stateId || dto.districtId || dto.ulbId || dto.wardId) {
      return [
        {
          stateId: dto.stateId ?? "",
          districtId: dto.districtId ?? "",
          ulbId: dto.ulbId ?? "",
          wardId: normalizeAllotmentWardId(dto.wardId),
        },
      ]
    }
    return []
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

  /**
   * Unified delete lifecycle:
   * - History exists → soft-deactivate + revoke Clerk access (retain surveys/audits).
   * - No history → delete Clerk first, then hard-delete Postgres row.
   * Clerk delete failures (other than 404) leave the row inactive and surface an error.
   */
  async remove(id: string, actor: AuthenticatedUser) {
    if (id === actor.id) {
      throw new ForbiddenException("You cannot delete your own account")
    }

    const user = await this.findById(id, actor)
    const blockers = await this.usersRepository.countDeleteBlockers(id)
    const reasons = this.formatDeleteBlockers(blockers)
    const hasHistory = reasons.length > 0
    const pendingClerk = isPendingClerkUserId(user.clerkUserId)

    if (hasHistory) {
      await this.usersRepository.deactivateIdentity({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        clerkUserId: user.clerkUserId,
        actorId: actor.id,
        source: "admin.delete.history_retained",
      })
      this.logger.log(`User deactivated (history retained) ${id} by ${actor.id}: ${reasons.join(", ")}`)

      if (!pendingClerk) {
        await this.deleteClerkUserOrThrow(user.clerkUserId, {
          onFailureDeactivate: false,
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
          actorId: actor.id,
        })
      }

      return {
        id,
        deleted: false as const,
        deactivated: true as const,
        historyRetained: true as const,
        reasons,
      }
    }

    if (!pendingClerk) {
      await this.deleteClerkUserOrThrow(user.clerkUserId, {
        onFailureDeactivate: true,
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        actorId: actor.id,
      })
    }

    await this.prisma.db.securityAudit.create({
      data: {
        action: "USER_DELETED",
        actorId: actor.id,
        targetType: "User",
        targetId: id,
        oldValue: {
          email: user.email,
          fullName: user.fullName,
          clerkUserId: user.clerkUserId,
          isActive: user.isActive,
        },
      },
    })

    await this.usersRepository.hardDelete(id)
    this.logger.log(`User hard-delete ${id} by ${actor.id}`)

    return { id, deleted: true as const, deactivated: false as const, historyRetained: false as const }
  }

  private formatDeleteBlockers(blockers: Awaited<ReturnType<UsersRepository["countDeleteBlockers"]>>): string[] {
    const labels: Array<[keyof typeof blockers, string]> = [
      ["surveysCreated", "surveys created"],
      ["surveysAssigned", "surveys assigned"],
      ["surveyAuditsChanged", "survey audit entries"],
      ["securityAuditsActor", "security audit entries"],
      ["importJobsCreated", "import jobs"],
      ["exportJobsCreated", "export jobs"],
      ["qcRemarksAuthored", "QC remarks"],
      ["rolesAssigned", "roles assigned by them"],
      ["rolesDeactivated", "roles deactivated by them"],
    ]
    return labels.filter(([key]) => blockers[key] > 0).map(([key, label]) => `${blockers[key]} ${label}`)
  }

  private async deleteClerkUserOrThrow(
    clerkUserId: string,
    context: {
      onFailureDeactivate: boolean
      userId: string
      email: string
      fullName: string
      actorId: string
    }
  ): Promise<void> {
    const secretKey = this.configService.get<string>("CLERK_SECRET_KEY")
    if (!secretKey) {
      if (context.onFailureDeactivate) {
        await this.usersRepository.deactivateIdentity({
          userId: context.userId,
          email: context.email,
          fullName: context.fullName,
          clerkUserId,
          actorId: context.actorId,
          source: "admin.delete.clerk_unavailable",
        })
      }
      throw new ServiceUnavailableException(
        "CLERK_SECRET_KEY is not configured — account access was revoked locally but Clerk could not be updated"
      )
    }

    try {
      const clerk = createClerkClient({ secretKey })
      await clerk.users.deleteUser(clerkUserId)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const status = typeof err === "object" && err !== null && "status" in err ? Number(err.status) : undefined
      if (status === 404 || /not found/i.test(message)) {
        this.logger.log(`Clerk user ${clerkUserId} already absent`)
        return
      }
      this.logger.warn(`Clerk delete failed for ${clerkUserId}: ${message}`)
      if (context.onFailureDeactivate) {
        await this.usersRepository.deactivateIdentity({
          userId: context.userId,
          email: context.email,
          fullName: context.fullName,
          clerkUserId,
          actorId: context.actorId,
          source: "admin.delete.clerk_failed",
        })
      }
      throw new ServiceUnavailableException(
        "Could not delete the Clerk identity. The account has been deactivated locally — retry or finish removal in Clerk."
      )
    }
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
    if (actor.permissions.includes(PERMISSIONS.ROLE_ASSIGN) && this.isUnaffiliatedOrPending(target)) {
      return true
    }
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

  private isUnaffiliatedOrPending(target: {
    tenantRoles: Array<{
      isActive: boolean
      stateId: string | null
      districtId: string | null
      ulbId: string | null
      wardId: string | null
    }>
  }) {
    const active = target.tenantRoles.filter((role) => role.isActive)
    if (active.length === 0) return true
    return active.every((role) => !role.stateId && !role.districtId && !role.ulbId && !role.wardId)
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
