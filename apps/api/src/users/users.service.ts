import { createClerkClient } from "@clerk/backend"
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
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
import { isPendingClerkUserId } from "./pending-clerk-id.util.js"
import { UserImportService } from "./user-import.service.js"
import { UsersRepository } from "./users.repository.js"

const ROLES_REQUIRING_FULL_GEO = new Set(["SURVEYOR", "FIELD_SUPERVISOR"])
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

    // DEPT_ADMIN may only grant Clerk/Operator inside the same ULB
    if (isDepartmentRole(role.name) && !actorScope.isGlobal) {
      const actorDeptUlbs = actor.tenantRoles
        .filter((r) => r.isActive && isDepartmentRole(r.roleName) && r.ulbId)
        .map((r) => r.ulbId as string)
      if (ulbId && actorDeptUlbs.length && !actorDeptUlbs.includes(ulbId)) {
        throw new ForbiddenException("Cannot assign department roles outside your ULB")
      }
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
      throw new ForbiddenException("You cannot delete your own account")
    }

    const user = await this.findById(id, actor)
    const blockers = await this.usersRepository.countDeleteBlockers(id)
    const reasons = this.formatDeleteBlockers(blockers)
    if (reasons.length > 0) {
      throw new ConflictException(
        `Cannot delete user — linked records still reference them: ${reasons.join(", ")}. Remove or reassign that work first, or disable the account instead.`
      )
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

    if (!isPendingClerkUserId(user.clerkUserId)) {
      await this.deleteClerkUser(user.clerkUserId)
    }

    return { id, deleted: true as const }
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

  private async deleteClerkUser(clerkUserId: string) {
    const secretKey = this.configService.get<string>("CLERK_SECRET_KEY")
    if (!secretKey) {
      this.logger.warn(`CLERK_SECRET_KEY missing — skipped Clerk delete for ${clerkUserId}`)
      return
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
      this.logger.warn(`Clerk delete failed for ${clerkUserId} after DB delete: ${message}`)
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
