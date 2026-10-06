import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Reflector } from "@nestjs/core"
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from "@nestjs/throttler"
import { clerkInstances, verifySessionToken, type ClerkInstance } from "./clerk-instance.js"
import { readClientIp, throttleTrackerKey } from "./throttle-tracker.js"

type TrackerRequest = {
  ip?: unknown
  user?: { id?: string }
  headers?: Record<string, string | string[] | undefined>
}

/**
 * Rates limits by authenticated user, and by client IP when the caller is anonymous.
 * Runs before `ClerkAuthGuard`, so a Bearer token is verified locally (JWKS) here
 * and is not taken from an unverified `sub` claim.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(UserThrottlerGuard.name)
  private readonly allowDevAuth: boolean
  private readonly clockSkewInMs: number
  private instances: ClerkInstance[] | null = null

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly configService: ConfigService
  ) {
    super(options, storageService, reflector)
    const nodeEnv = this.configService.get<string>("NODE_ENV") ?? "development"
    this.allowDevAuth = nodeEnv !== "production" && this.configService.get<string>("ALLOW_DEV_AUTH") === "true"
    const configuredSkew = this.configService.get<number>("CLERK_CLOCK_SKEW_MS")
    this.clockSkewInMs = typeof configuredSkew === "number" && Number.isFinite(configuredSkew) ? configuredSkew : 30_000
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as TrackerRequest
    const ip = readClientIp(request)
    const userId = await this.resolveTrackerUserId(request)
    const key = throttleTrackerKey({ userId, ip })
    return key
  }

  protected override async throwThrottlingException(
    context: Parameters<ThrottlerGuard["throwThrottlingException"]>[0],
    detail: Parameters<ThrottlerGuard["throwThrottlingException"]>[1]
  ): Promise<void> {
    const http = context.switchToHttp().getRequest<TrackerRequest & { method?: string; url?: string }>()
    const route = (http.url ?? "").split("?")[0] ?? ""
    const trackerKind = detail.tracker.startsWith("user:") ? "user" : "ip"
    this.logger.warn(
      `status=429 errorCode=429 method=${http.method ?? ""} route=${route} trackerKind=${trackerKind} limit=${detail.limit} hits=${detail.totalHits}`
    )
    await super.throwThrottlingException(context, detail)
  }

  private async resolveTrackerUserId(req: TrackerRequest): Promise<string | null> {
    const authenticatedId = req.user?.id?.trim()
    if (authenticatedId) {
      return authenticatedId
    }
    const token = readBearerToken(req)
    if (!token) {
      return null
    }
    const devUserId = this.readDevUserId(token, req)
    if (devUserId) {
      return devUserId
    }
    if (!looksLikeJwt(token)) {
      return null
    }
    return this.verifyClerkSubject(token)
  }

  private readDevUserId(token: string, req: TrackerRequest): string | null {
    if (!this.allowDevAuth) {
      return null
    }
    const header = readHeader(req, "x-dev-clerk-user-id")
    const fromBearer = token.startsWith("dev:") ? token.slice(4).trim() : token === "dev" ? header : undefined
    const resolved = (fromBearer || header)?.trim()
    return resolved && resolved.length > 0 ? resolved : null
  }

  private loadInstances(): ClerkInstance[] {
    if (!this.instances) {
      this.instances = clerkInstances(this.configService)
    }
    return this.instances
  }

  private async verifyClerkSubject(token: string): Promise<string | null> {
    const instances = this.loadInstances()
    for (const instance of instances) {
      try {
        const payload = await verifySessionToken(token, instance, this.clockSkewInMs)
        const subject = typeof payload.sub === "string" ? payload.sub.trim() : ""
        return subject.length > 0 ? subject : null
      } catch {
        // Try the next configured Clerk instance. Invalid tokens fall back to the IP bucket.
      }
    }
    return null
  }
}

function readHeader(req: TrackerRequest, name: string): string | undefined {
  const value = req.headers?.[name]
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === "string" && first.trim().length > 0 ? first.trim() : undefined
}

function readBearerToken(req: TrackerRequest): string | null {
  const header = readHeader(req, "authorization")
  if (!header?.startsWith("Bearer ")) {
    return null
  }
  const token = header.slice(7).trim()
  return token.length > 0 ? token : null
}

function looksLikeJwt(token: string): boolean {
  const parts = token.split(".")
  return parts.length === 3 && parts.every((part) => part.length > 0)
}
