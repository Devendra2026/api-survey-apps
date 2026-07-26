import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { RoleProvisioningService } from "../common/services/role-provisioning.service.js"
import { canGrantRole } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { isPendingClerkUserId, normalizeEmail, pendingClerkUserId } from "./pending-clerk-id.util.js"

const GEO_REQUIRED_ROLES = new Set(["SURVEYOR", "FIELD_SUPERVISOR"])
const IMPORTABLE_ROLES = new Set([
  "PENDING_APPROVAL",
  "SURVEYOR",
  "FIELD_SUPERVISOR",
  "QC_SUPERVISOR",
  "ADMIN",
  "DEPT_ADMIN",
  "DEPT_CLERK",
  "DEPT_OPERATOR",
])

export type UpsertUserSource = "clerk-sync" | "file-import" | "auth"

export type UpsertUserInput = {
  email: string
  /** Real Clerk user id when known. Omit for email-first imports. */
  clerkUserId?: string | null
  fullName?: string | null
  phone?: string | null
  /** Optional role from file import (not used by Clerk sync). */
  roleName?: string | null
  source: UpsertUserSource
  /** Actor performing import (required when roleName is set). */
  actor?: AuthenticatedUser
}

export type UpsertUserResult = {
  action: "created" | "updated" | "skipped"
  userId: string
  clerkUserId: string
  email: string
  warnings: string[]
}

@Injectable()
export class UserUpsertService {
  private readonly logger = new Logger(UserUpsertService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly roleProvisioning: RoleProvisioningService
  ) {}

  async upsert(input: UpsertUserInput): Promise<UpsertUserResult> {
    const email = normalizeEmail(input.email)
    if (!email || !email.includes("@")) {
      throw new BadRequestException("A valid email is required")
    }

    const warnings: string[] = []
    const realClerkId = input.clerkUserId?.trim() || null
    if (realClerkId && isPendingClerkUserId(realClerkId)) {
      throw new BadRequestException("Invalid Clerk user id")
    }

    const existing = await this.findExisting(realClerkId, email)
    const fullName = this.pickNonEmpty(input.fullName, existing?.fullName) ?? email.split("@")[0] ?? "User"
    const phone = this.pickOptionalPhone(input.phone, existing?.phone)
    const clerkUserId = realClerkId ?? existing?.clerkUserId ?? pendingClerkUserId(email)

    if (!existing) {
      const created = await this.prisma.db.user.create({
        data: {
          clerkUserId,
          email,
          fullName,
          phone,
          isActive: true,
        },
      })
      await this.applyAccess(created.id, input, warnings)
      this.logger.log(`User upsert created id=${created.id} source=${input.source}`)
      return {
        action: "created",
        userId: created.id,
        clerkUserId: created.clerkUserId,
        email: created.email,
        warnings,
      }
    }

    const patch: {
      email?: string
      fullName?: string
      phone?: string | null
      clerkUserId?: string
    } = {}

    if (email && email !== existing.email) {
      patch.email = email
    }
    if (fullName && fullName !== existing.fullName) {
      patch.fullName = fullName
    }
    if (phone !== undefined && phone !== existing.phone) {
      patch.phone = phone
    }
    if (realClerkId && realClerkId !== existing.clerkUserId) {
      if (!isPendingClerkUserId(existing.clerkUserId) && existing.clerkUserId !== realClerkId) {
        warnings.push(`Existing clerkUserId retained (${existing.clerkUserId}); incoming id ignored`)
      } else {
        patch.clerkUserId = realClerkId
      }
    }

    // Never flip isActive false on sync/import — preserve admin disables.
    const updated =
      Object.keys(patch).length > 0
        ? await this.prisma.db.user.update({ where: { id: existing.id }, data: patch })
        : existing

    await this.applyAccess(updated.id, input, warnings)

    this.logger.log(`User upsert updated id=${updated.id} source=${input.source}`)
    return {
      action: "updated",
      userId: updated.id,
      clerkUserId: updated.clerkUserId,
      email: updated.email,
      warnings,
    }
  }

  /**
   * Preview match + validation without writing (for import dry-run).
   */
  async preview(input: UpsertUserInput): Promise<{
    status: "ok" | "warn" | "error"
    action: "create" | "update"
    message: string
    warnings: string[]
  }> {
    const warnings: string[] = []
    try {
      const email = normalizeEmail(input.email)
      if (!email || !email.includes("@")) {
        return { status: "error", action: "create", message: "Valid email is required", warnings }
      }
      const realClerkId = input.clerkUserId?.trim() || null
      if (realClerkId && isPendingClerkUserId(realClerkId)) {
        return { status: "error", action: "create", message: "Invalid Clerk user id", warnings }
      }

      const existing = await this.findExisting(realClerkId, email)
      const action = existing ? ("update" as const) : ("create" as const)

      if (!realClerkId) {
        warnings.push("No Clerk id — will use pending: placeholder until first sign-in")
      }

      if (input.roleName) {
        const roleCheck = this.validateImportRole(input.roleName, input.actor)
        if (roleCheck.error) {
          return { status: "error", action, message: roleCheck.error, warnings }
        }
        warnings.push(...roleCheck.warnings)
      } else if (input.source === "file-import") {
        warnings.push("No role column — will assign PENDING_APPROVAL if user has no active role")
      }

      if (existing && !existing.isActive) {
        warnings.push("User is disabled — import will not reactivate them")
      }

      const status = warnings.length ? ("warn" as const) : ("ok" as const)
      return {
        status,
        action,
        message: existing ? `Will update existing user (${existing.email})` : "Will create new user",
        warnings,
      }
    } catch (err) {
      return {
        status: "error",
        action: "create",
        message: err instanceof Error ? err.message : "Preview failed",
        warnings,
      }
    }
  }

  private async findExisting(clerkUserId: string | null, email: string) {
    if (clerkUserId) {
      const byClerk = await this.prisma.db.user.findUnique({ where: { clerkUserId } })
      if (byClerk) return byClerk
    }
    return this.prisma.db.user.findUnique({ where: { email } })
  }

  private async applyAccess(userId: string, input: UpsertUserInput, warnings: string[]): Promise<void> {
    if (input.source === "file-import" && input.roleName?.trim()) {
      await this.assignImportRole(userId, input.roleName.trim(), input.actor, warnings)
      return
    }

    // Sync / auth / import without role: ensure PENDING if no active role
    await this.roleProvisioning.ensurePendingApproval(userId)
  }

  private validateImportRole(
    roleNameRaw: string,
    actor: AuthenticatedUser | undefined
  ): { error?: string; warnings: string[] } {
    const warnings: string[] = []
    const roleName = roleNameRaw.trim().toUpperCase()
    if (!IMPORTABLE_ROLES.has(roleName)) {
      return { error: `Unknown role "${roleNameRaw}"`, warnings }
    }
    if (!actor) {
      return { error: "Actor required to assign roles on import", warnings }
    }
    const actorRoleNames = actor.tenantRoles.filter((r) => r.isActive).map((r) => r.roleName)
    if (!canGrantRole(actorRoleNames, roleName)) {
      return { error: `Your role cannot grant ${roleName}`, warnings }
    }
    if (GEO_REQUIRED_ROLES.has(roleName)) {
      warnings.push(`${roleName} assigned without geography — set location via onboard later`)
    }
    return { warnings }
  }

  private async assignImportRole(
    userId: string,
    roleNameRaw: string,
    actor: AuthenticatedUser | undefined,
    warnings: string[]
  ): Promise<void> {
    const check = this.validateImportRole(roleNameRaw, actor)
    if (check.error) throw new ForbiddenException(check.error)
    warnings.push(...check.warnings)

    const roleName = roleNameRaw.trim().toUpperCase()
    const role = await this.prisma.db.role.findUnique({ where: { name: roleName } })
    if (!role) throw new BadRequestException(`Role ${roleName} not found — run db seed`)

    const assignedBy = actor!.id
    await this.prisma.db.userTenantRole.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, deactivatedAt: new Date(), deactivatedBy: assignedBy },
    })

    await this.prisma.db.userTenantRole.create({
      data: {
        userId,
        roleId: role.id,
        assignedBy,
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    })
  }

  private pickNonEmpty(incoming: string | null | undefined, existing: string | null | undefined): string | null {
    const value = incoming?.trim()
    if (value) return value
    return existing?.trim() || null
  }

  private pickOptionalPhone(
    incoming: string | null | undefined,
    existing: string | null | undefined
  ): string | null | undefined {
    if (incoming === undefined) return existing
    const value = incoming?.trim()
    if (!value) return existing ?? null
    return value
  }
}
