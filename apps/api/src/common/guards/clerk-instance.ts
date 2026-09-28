import { createClerkClient, verifyToken } from "@clerk/backend"
import { Logger } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import { clerkKeyKind, clerkKeysEnvironmentMismatch } from "./clerk-email-verification.js"

export type ClerkInstance = {
  name: "admin" | "portal"
  secretKey: string
  authorizedParties: string[]
}

const logger = new Logger("ClerkInstances")

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
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

export async function verifySessionToken(token: string, instance: ClerkInstance, clockSkewInMs: number) {
  return verifyToken(token, {
    secretKey: instance.secretKey,
    clockSkewInMs,
    ...(instance.authorizedParties.length ? { authorizedParties: instance.authorizedParties } : {}),
  })
}

export function clerkClientFor(secretKey: string) {
  return createClerkClient({ secretKey })
}
