import { createClerkClient, verifyToken } from "@clerk/backend"
import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Reflector } from "@nestjs/core"
import { PrismaService } from "../../prisma/prisma.service.js"
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js"
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface.js"
import { TenantScopeService } from "../services/tenant-scope.service.js"

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name)
  private readonly clerk

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantScopeService: TenantScopeService
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

    if (!secretKey) {
      const nodeEnv = this.configService.get<string>("NODE_ENV") ?? "development"
      const devMode = nodeEnv !== "production"
      const devUserId = (request.headers as Record<string, string>)["x-dev-clerk-user-id"]
      if (devMode && devUserId) {
        request.user = await this.resolveLocalUser({
          clerkUserId: devUserId,
          email: `${devUserId}@dev.local`,
          fullName: "Dev User",
          phone: null,
          profileFetched: true,
        })
        return true
      }
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

      const payload = await verifyToken(token, {
        secretKey,
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
      throw new UnauthorizedException("User account is inactive")
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
