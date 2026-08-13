import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Reflector } from "@nestjs/core"
import { PrismaService } from "../../prisma/prisma.service.js"
import { isPendingClerkUserId, normalizeEmail } from "../../users/pending-clerk-id.util.js"
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js"
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface.js"
import { RoleProvisioningService } from "../services/role-provisioning.service.js"
import { TenantScopeService } from "../services/tenant-scope.service.js"
import { clerkClientFor, clerkInstances, verifySessionToken, type ClerkInstance } from "./clerk-instance.js"

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name)
  private readonly instances: ClerkInstance[]

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantScopeService: TenantScopeService,
    private readonly roleProvisioning: RoleProvisioningService
  ) {
    this.instances = clerkInstances(this.configService)
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string }
      user?: AuthenticatedUser
    }>()

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing Bearer token")
    }

    const token = authHeader.slice(7)
    const nodeEnv = this.configService.get<string>("NODE_ENV") ?? "development"
    const allowDevAuth = this.configService.get<string>("ALLOW_DEV_AUTH") === "true"
    const devMode = nodeEnv !== "production" && allowDevAuth

    // Local ETL / scripts: Authorization: Bearer dev  + x-dev-clerk-user-id
    // or Authorization: Bearer dev:<clerkUserId>
    if (devMode) {
      const headerDevUserId = (request.headers as Record<string, string | string[] | undefined>)["x-dev-clerk-user-id"]
      const fromHeader = Array.isArray(headerDevUserId) ? headerDevUserId[0] : headerDevUserId
      const fromBearer = token.startsWith("dev:") ? token.slice(4).trim() : token === "dev" ? fromHeader : undefined
      const resolvedDevUserId = (fromBearer || fromHeader)?.trim()
      if (resolvedDevUserId) {
        request.user = await this.resolveLocalUser({
          clerkUserId: resolvedDevUserId,
          email: `${resolvedDevUserId}@dev.local`,
          fullName: "Dev User",
          phone: null,
          profileFetched: true,
        })
        return true
      }
    }

    if (this.instances.length === 0) {
      throw new UnauthorizedException("CLERK_SECRET_KEY is not configured")
    }

    let clerkUserId = ""
    let email = ""
    let fullName = "User"
    let phone: string | null = null
    let profileFetched = false
    let matched: ClerkInstance | null = null

    const configuredSkew = this.configService.get<number>("CLERK_CLOCK_SKEW_MS")
    const clockSkewInMs =
      typeof configuredSkew === "number" && Number.isFinite(configuredSkew) ? configuredSkew : 30_000

    let lastVerifyError: unknown
    for (const instance of this.instances) {
      try {
        const payload = await verifySessionToken(token, instance, clockSkewInMs)
        if (!payload.sub) throw new UnauthorizedException("Invalid token subject")
        clerkUserId = payload.sub
        matched = instance
        break
      } catch (err) {
        if (err instanceof UnauthorizedException) throw err
        lastVerifyError = err
      }
    }

    if (!matched) {
      this.logger.warn(`JWT verification failed: ${String(lastVerifyError)}`)
      throw new UnauthorizedException("Invalid or expired token")
    }

    try {
      const clerkUser = await clerkClientFor(matched.secretKey).users.getUser(clerkUserId)
      email =
        clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
        clerkUser.emailAddresses[0]?.emailAddress ??
        ""
      fullName =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
        clerkUser.username ||
        email ||
        "User"
      phone = clerkUser.primaryPhoneNumber?.phoneNumber ?? null
      profileFetched = Boolean(email)
    } catch (err) {
      this.logger.warn(`Failed to fetch Clerk user ${clerkUserId} (${matched.name}): ${String(err)}`)
    }

    request.user = await this.resolveLocalUser({
      clerkUserId,
      email,
      fullName,
      phone,
      profileFetched,
    })
    return true
  }

  private async resolveLocalUser(input: {
    clerkUserId: string
    email: string
    fullName: string
    phone: string | null
    profileFetched: boolean
  }): Promise<AuthenticatedUser> {
    const now = new Date()
    let existing = await this.prisma.db.user.findUnique({
      where: { clerkUserId: input.clerkUserId },
    })

    const normalizedEmail = input.profileFetched && input.email ? normalizeEmail(input.email) : (existing?.email ?? "")

    // Email-first: pending:{email} rebind, or same officer on the Etah portal Clerk instance.
    if (!existing && normalizedEmail) {
      const byEmail = await this.prisma.db.user.findUnique({ where: { email: normalizedEmail } })
      if (byEmail && isPendingClerkUserId(byEmail.clerkUserId)) {
        existing = await this.prisma.db.user.update({
          where: { id: byEmail.id },
          data: {
            clerkUserId: input.clerkUserId,
            ...(input.profileFetched
              ? {
                  email: normalizedEmail,
                  fullName: input.fullName !== "User" ? input.fullName : (byEmail.fullName ?? input.fullName),
                  phone: input.phone ?? byEmail.phone,
                }
              : {}),
            lastLoginAt: now,
          },
        })
        this.logger.log(`Rebound pending user ${byEmail.id} to clerkUserId=${input.clerkUserId}`)
      } else if (byEmail) {
        existing = byEmail
        this.logger.log(`Linked portal Clerk login to existing user ${byEmail.id} by email`)
      }
    }

    const email =
      input.profileFetched && input.email
        ? normalizeEmail(input.email)
        : (existing?.email ?? `${input.clerkUserId}@clerk.local`)
    const fullName =
      input.profileFetched && input.fullName !== "User" ? input.fullName : (existing?.fullName ?? input.fullName)

    const user = existing
      ? await this.prisma.db.user.update({
          where: { id: existing.id },
          data: {
            ...(input.profileFetched
              ? {
                  email,
                  fullName,
                  phone: input.phone ?? undefined,
                }
              : {}),
            lastLoginAt: now,
          },
        })
      : await this.prisma.db.user.create({
          data: {
            clerkUserId: input.clerkUserId,
            email,
            fullName,
            phone: input.phone,
            lastLoginAt: now,
          },
        })

    if (!user.isActive) {
      throw new UnauthorizedException("Your account has been disabled. Please contact the system administrator.")
    }

    const bootstrapped = await this.roleProvisioning.ensureBootstrapAdmin(user.id, user.clerkUserId)
    if (!bootstrapped) {
      await this.roleProvisioning.ensurePendingApproval(user.id)
    }
    const ctx = await this.tenantScopeService.loadUserContext(user.id)

    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive,
      permissions: ctx.permissions,
      tenantRoles: ctx.tenantRoles,
    }
  }
}
