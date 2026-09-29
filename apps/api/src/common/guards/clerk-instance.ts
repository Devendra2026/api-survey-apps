import { createClerkClient, verifyToken } from "@clerk/backend"
import { TokenVerificationError, TokenVerificationErrorReason } from "@clerk/backend/errors"
import { Logger, UnauthorizedException } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import { clerkKeyKind, clerkKeysEnvironmentMismatch } from "./clerk-email-verification.js"

export type ClerkInstance = {
  name: "admin" | "portal"
  secretKey: string
  authorizedParties: string[]
}

/** Safe JWT claim snapshot for logs — never include the raw token. */
export type SessionTokenDiagnostics = {
  iss: string | null
  azp: string | null
  sub: string | null
  sid: string | null
}

export type SessionTokenVerifyFailure = {
  kind: "expired" | "authorized_party" | "invalid"
  reason: string
  diagnostics: SessionTokenDiagnostics
  cause: unknown
}

const logger = new Logger("ClerkInstances")

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function readClaim(payload: object, key: string): string | null {
  if (!(key in payload)) {
    return null
  }
  return asOptionalString((payload as Record<string, unknown>)[key])
}

export function sessionTokenDiagnostics(payload: object): SessionTokenDiagnostics {
  return {
    iss: readClaim(payload, "iss"),
    azp: readClaim(payload, "azp"),
    sub: readClaim(payload, "sub"),
    sid: readClaim(payload, "sid"),
  }
}

export function formatSessionTokenDiagnostics(d: SessionTokenDiagnostics): string {
  return `iss=${d.iss ?? "absent"} azp=${d.azp ?? "absent"} sub=${d.sub ?? "absent"} sid=${d.sid ?? "absent"}`
}

/**
 * Browser tokens include `azp` (Origin). Expo/native tokens typically omit it because
 * React Native does not send Origin. Passing `authorizedParties` into Clerk's verifyToken
 * rejects missing azp (@clerk/backend ≥ 3.11.1). Enforce the allowlist only when azp is present.
 */
export function assertSessionAuthorizedParty(azp: string | undefined, authorizedParties: string[]): void {
  if (authorizedParties.length === 0) {
    return
  }
  const party = typeof azp === "string" ? azp.trim() : ""
  if (!party) {
    // Native Expo session — signature already verified by verifyToken.
    return
  }
  if (!authorizedParties.includes(party)) {
    throw new UnauthorizedException(
      "Session token authorized party is not allowed for this API. Ask an administrator to review CLERK_AUTHORIZED_PARTIES."
    )
  }
}

export function classifyTokenVerificationError(err: unknown): SessionTokenVerifyFailure["kind"] {
  if (err instanceof UnauthorizedException) {
    const message = err.message
    if (/authorized party/i.test(message)) {
      return "authorized_party"
    }
    return "invalid"
  }
  if (err instanceof TokenVerificationError) {
    if (err.reason === TokenVerificationErrorReason.TokenExpired) {
      return "expired"
    }
    if (err.reason === TokenVerificationErrorReason.TokenInvalidAuthorizedParties) {
      return "authorized_party"
    }
    return "invalid"
  }
  const message = err instanceof Error ? err.message : String(err)
  if (/expired/i.test(message)) {
    return "expired"
  }
  if (/authorized party|authorizedParties|azp/i.test(message)) {
    return "authorized_party"
  }
  return "invalid"
}

export function unauthorizedMessageForVerifyKind(kind: SessionTokenVerifyFailure["kind"]): string {
  switch (kind) {
    case "expired":
      return "Session token expired. Sign in again."
    case "authorized_party":
      return "Session token authorized party is not allowed for this API. Ask an administrator to review CLERK_AUTHORIZED_PARTIES."
    case "invalid":
      return "Invalid session token. Confirm the API uses the same Clerk instance as this app."
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function clerkInstances(config: ConfigService): ClerkInstance[] {
  const adminSecret = config.get<string>("CLERK_SECRET_KEY")?.trim()
  const portalSecret = config.get<string>("PORTAL_CLERK_SECRET_KEY")?.trim()
  const instances: ClerkInstance[] = []

  if (adminSecret) {
    instances.push({
      name: "admin",
      secretKey: adminSecret,
      authorizedParties: splitList(config.get<string>("CLERK_AUTHORIZED_PARTIES")),
    })
  }

  if (portalSecret && portalSecret !== adminSecret) {
    instances.push({
      name: "portal",
      secretKey: portalSecret,
      authorizedParties: splitList(config.get<string>("PORTAL_CLERK_AUTHORIZED_PARTIES")),
    })
  } else if (portalSecret && portalSecret === adminSecret) {
    logger.error(
      "PORTAL_CLERK_SECRET_KEY equals CLERK_SECRET_KEY. The Etah portal Clerk instance is skipped. Portal JWTs will return 401 Invalid or expired token. Use the portal sk_live_ (clerk.nppetah.in), not the admin secret."
    )
  } else if (adminSecret && !portalSecret) {
    logger.warn("PORTAL_CLERK_SECRET_KEY is not set. Etah portal (portal.nppetah.in) JWTs cannot be verified.")
  }

  const publishableKind = clerkKeyKind(config.get<string>("CLERK_PUBLISHABLE_KEY"))
  const secretKind = clerkKeyKind(adminSecret)
  logger.log(`Clerk admin keys: publishable=${publishableKind} secret=${secretKind}`)
  if (clerkKeysEnvironmentMismatch(publishableKind, secretKind)) {
    logger.error(
      `CLERK_PUBLISHABLE_KEY (${publishableKind}) and CLERK_SECRET_KEY (${secretKind}) are from different Clerk environments. ` +
        "Mobile/web sessions from one instance will fail verification or resolve to different Clerk users."
    )
  }

  logger.log(`Clerk JWT instances loaded: ${instances.map((instance) => instance.name).join(", ") || "none"}`)

  return instances
}

/**
 * Verify signature / issuer (JWKS) / expiry via Clerk, then enforce azp only when present.
 * Do not pass authorizedParties into verifyToken — that rejects Expo tokens with no azp.
 */
export async function verifySessionToken(token: string, instance: ClerkInstance, clockSkewInMs: number) {
  const payload = await verifyToken(token, {
    secretKey: instance.secretKey,
    clockSkewInMs,
  })
  assertSessionAuthorizedParty(typeof payload.azp === "string" ? payload.azp : undefined, instance.authorizedParties)
  return payload
}

export function clerkClientFor(secretKey: string) {
  return createClerkClient({ secretKey })
}
