import { createClerkClient, verifyToken } from "@clerk/backend"
import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Reflector } from "@nestjs/core"
import { PrismaService } from "../../prisma/prisma.service.js"
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js"
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface.js"
import { RoleProvisioningService } from "../services/role-provisioning.service.js"
import { TenantScopeService } from "../services/tenant-scope.service.js"

type ClerkClient = ReturnType<typeof createClerkClient>

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name)
  private readonly clerk: ClerkClient | null

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantScopeService: TenantScopeService,
    private readonly roleProvisioning: RoleProvisioningService
  ) {
    const secretKey = this.configService.get<string>("CLERK_SECRET_KEY")
    this.clerk = secretKey ? createClerkClient({ secretKey }) : null
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
    const secretKey = this.configService.get<string>("CLERK_SECRET_KEY")
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

    if (!secretKey) {
      throw new UnauthorizedException("CLERK_SECRET_KEY is not configured")
    }

    let clerkUserId: string
    let email = ""
    let fullName = "User"
    let phone: string | null = null
    let profileFetched = false

    try {
      const authorizedParties = this.configService
        .get<string>("CLERK_AUTHORIZED_PARTIES")
        ?.split(",")
        .map((p) => p.trim())
        .filter(Boolean)

      // Default Clerk skew is 5s; Windows clocks often drift ~5–15s which rejects
      // tokens with iat slightly in the future. Allow override via env.
      const configuredSkew = this.configService.get<number>("CLERK_CLOCK_SKEW_MS")
      const clockSkewInMs =
        typeof configuredSkew === "number" && Number.isFinite(configuredSkew) ? configuredSkew : 30_000

      const payload = await verifyToken(token, {
        secretKey,
        clockSkewInMs,
        ...(authorizedParties?.length ? { authorizedParties } : {}),
      })
      if (!payload.sub) throw new UnauthorizedException("Invalid token subject")
      clerkUserId = payload.sub
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err
      this.logger.warn(`JWT verification failed: ${String(err)}`)
      throw new UnauthorizedException("Invalid or expired token")
    }

    if (this.clerk) {
      try {
        const clerkUser = await this.clerk.users.getUser(clerkUserId)
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
        this.logger.warn(`Failed to fetch Clerk user ${clerkUserId}: ${String(err)}`)
      }
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
    const existing = await this.prisma.db.user.findUnique({
      where: { clerkUserId: input.clerkUserId },
    })

    const email =
      input.profileFetched && input.email ? input.email : (existing?.email ?? `${input.clerkUserId}@clerk.local`)
    const fullName =
      input.profileFetched && input.fullName !== "User" ? input.fullName : (existing?.fullName ?? input.fullName)

    const user = await this.prisma.db.user.upsert({
      where: { clerkUserId: input.clerkUserId },
      create: {
        clerkUserId: input.clerkUserId,
        email,
        fullName,
        phone: input.phone,
        lastLoginAt: now,
      },
      update: {
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
