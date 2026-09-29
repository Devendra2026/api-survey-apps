import { TokenVerificationError } from "@clerk/backend/errors"
import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Reflector } from "@nestjs/core"
import { PrismaService } from "../../prisma/prisma.service.js"
import { isPendingClerkUserId, normalizeEmail } from "../../users/pending-clerk-id.util.js"
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js"
import type { AuthenticatedUser } from "../interfaces/authenticated-user.interface.js"
import { RoleProvisioningService } from "../services/role-provisioning.service.js"
import { TenantScopeService } from "../services/tenant-scope.service.js"
import { resolveClerkEmailVerification } from "./clerk-email-verification.js"
import {
  classifyTokenVerificationError,
  clerkClientFor,
  clerkInstances,
  formatSessionTokenDiagnostics,
  sessionTokenDiagnostics,
  unauthorizedMessageForVerifyKind,
  verifySessionToken,
  type ClerkInstance,
  type SessionTokenDiagnostics,
} from "./clerk-instance.js"

/** Decode JWT payload claims for safe failure logs only. Never trust for authorization. */
function peekSessionTokenClaims(token: string): SessionTokenDiagnostics {
  const segment = token.split(".")[1]
  if (!segment) {
    return { iss: null, azp: null, sub: null, sid: null }
  }
  try {
    const padded = segment.replace(/-/g, "+").replace(/_/g, "/")
    const json = Buffer.from(padded, "base64").toString("utf8")
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== "object" || parsed === null) {
      return { iss: null, azp: null, sub: null, sid: null }
    }
    return sessionTokenDiagnostics(parsed)
  } catch {
    return { iss: null, azp: null, sub: null, sid: null }
  }
}

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
    this.logger.log(`Clerk JWT instances: ${this.instances.map((instance) => instance.name).join(", ") || "none"}`)
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
    let emailVerified = false
    let verificationDetail = "clerkProfile=unavailable"
    let matched: ClerkInstance | null = null

    const configuredSkew = this.configService.get<number>("CLERK_CLOCK_SKEW_MS")
    const clockSkewInMs =
      typeof configuredSkew === "number" && Number.isFinite(configuredSkew) ? configuredSkew : 30_000

    let lastVerifyError: unknown
    let lastVerifyKind: ReturnType<typeof classifyTokenVerificationError> = "invalid"
    for (const instance of this.instances) {
      try {
        const payload = await verifySessionToken(token, instance, clockSkewInMs)
        if (!payload.sub) throw new UnauthorizedException("Invalid token subject")
        clerkUserId = payload.sub
        matched = instance
        break
      } catch (err) {
        // Authorized-party rejection is definitive for this token; do not try other instances.
        if (err instanceof UnauthorizedException && /authorized party/i.test(err.message)) {
          const peeked = peekSessionTokenClaims(token)
          this.logger.warn(
            `JWT verification failed kind=authorized_party reason=azp_not_allowlisted ` +
              `instance=${instance.name} ${formatSessionTokenDiagnostics(peeked)}`
          )
          throw err
        }
        lastVerifyError = err
        lastVerifyKind = classifyTokenVerificationError(err)
      }
    }

    if (!matched) {
      const peeked = peekSessionTokenClaims(token)
      const reason =
        lastVerifyError instanceof TokenVerificationError
          ? lastVerifyError.reason
          : lastVerifyError instanceof Error
            ? lastVerifyError.message
            : String(lastVerifyError)
      this.logger.warn(
        `JWT verification failed kind=${lastVerifyKind} reason=${reason} ${formatSessionTokenDiagnostics(peeked)}`
      )
      throw new UnauthorizedException(unauthorizedMessageForVerifyKind(lastVerifyKind))
    }

    try {
      const clerkUser = await clerkClientFor(matched.secretKey).users.getUser(clerkUserId)
      const verification = resolveClerkEmailVerification(clerkUser)
      email = verification.email
      emailVerified = verification.verified
      verificationDetail =
        `emailStatus=${verification.primaryStatus} emailStrategy=${verification.primaryStrategy} ` +
        `providers=${verification.providers.join(",") || "none"} via=${verification.via} instance=${matched.name}`
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
      emailVerified,
      verificationDetail,
    })
    return true
  }

  private async resolveLocalUser(input: {
    clerkUserId: string
    email: string
    fullName: string
    phone: string | null
    profileFetched: boolean
    emailVerified?: boolean
    /** Log-safe Clerk verification summary (status, strategy, providers). Never tokens. */
    verificationDetail?: string
  }): Promise<AuthenticatedUser> {
    const now = new Date()
    const verifiedClerkUserId = input.clerkUserId
    let existing = await this.prisma.db.user.findUnique({
      where: { clerkUserId: verifiedClerkUserId },
    })

    const normalizedEmail = input.profileFetched && input.email ? normalizeEmail(input.email) : (existing?.email ?? "")

    // Email is a reconciliation key only after Clerk verified the address for this session.
    // Identity always ends as User.clerkUserId === verified JWT sub (never return another clerkUserId).
    if (!existing && normalizedEmail) {
      const byEmail = await this.prisma.db.user.findUnique({ where: { email: normalizedEmail } })
      if (byEmail) {
        if (!byEmail.isActive) {
          throw new UnauthorizedException("Your account has been disabled. Please contact the system administrator.")
        }

        const canRebind =
          isPendingClerkUserId(byEmail.clerkUserId) ||
          (Boolean(input.emailVerified) && byEmail.clerkUserId !== verifiedClerkUserId)

        if (canRebind && byEmail.clerkUserId !== verifiedClerkUserId) {
          const previousClerkUserId = byEmail.clerkUserId
          existing = await this.prisma.db.user.update({
            where: { id: byEmail.id },
            data: {
              clerkUserId: verifiedClerkUserId,
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
          this.logger.log(
            `Rebound user ${byEmail.id} clerkUserId ${previousClerkUserId} → ${verifiedClerkUserId} ` +
              `via=${isPendingClerkUserId(previousClerkUserId) ? "pending" : "verified-email"} lookup=clerkUserId`
          )
        } else if (byEmail.clerkUserId !== verifiedClerkUserId) {
          this.logger.warn(
            `Refusing email adoption without verified email: verified=${verifiedClerkUserId} ` +
              `existing=${byEmail.clerkUserId} databaseUserId=${byEmail.id} lookup=clerkUserId ` +
              (input.verificationDetail ?? "")
          )
          throw new UnauthorizedException(
            "This email is already linked to a different Clerk account. Sign in with the original account or contact an administrator."
          )
        } else {
          existing = byEmail
        }
      }
    }

    // Never invent a placeholder @clerk.local row when Clerk profile fetch failed — retry instead.
    if (!existing && !input.profileFetched) {
      this.logger.warn(`Refusing JIT create without Clerk profile for ${verifiedClerkUserId}`)
      throw new UnauthorizedException("Unable to resolve your account profile. Please try again.")
    }

    const email =
      input.profileFetched && input.email
        ? normalizeEmail(input.email)
        : (existing?.email ?? `${verifiedClerkUserId}@clerk.local`)
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
            clerkUserId: verifiedClerkUserId,
            email,
            fullName,
            phone: input.phone,
            lastLoginAt: now,
          },
        })

    if (user.clerkUserId !== verifiedClerkUserId) {
      this.logger.warn(
        `Identity invariant failed: verified=${verifiedClerkUserId} profile=${user.clerkUserId} lookup=clerkUserId`
      )
      throw new UnauthorizedException("Unable to resolve your account profile. Please try again.")
    }

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
