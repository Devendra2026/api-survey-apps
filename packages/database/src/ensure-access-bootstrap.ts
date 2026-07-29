import type { PrismaClient } from "./generated/prisma/client.js"
import { seedPermissionsAndRoles } from "./rbac-catalog.js"
import { promoteUserToAdmin } from "./role-promotion.js"

export type AccessBootstrapResult = {
  rbacEnsured: boolean
  adminClerkUserIds: string[]
  promoted: string[]
  alreadyAdmin: string[]
  failed: Array<{ clerkUserId: string; reason: string }>
}

function parseClerkUserIds(...rawValues: Array<string | undefined>): string[] {
  const ids = new Set<string>()
  for (const raw of rawValues) {
    if (!raw) continue
    for (const part of raw.split(",")) {
      const id = part.trim()
      if (id) ids.add(id)
    }
  }
  return [...ids]
}

/**
 * Ensures RBAC roles/permissions exist and promotes configured Clerk users to ADMIN.
 * Safe to run on every API boot (idempotent). Fixes production 403 when catalog seed
 * was never applied and BOOTSTRAP_ADMIN_CLERK_USER_IDS is set.
 */
export async function ensureAccessBootstrap(
  db: PrismaClient,
  options: {
    bootstrapAdminClerkUserIds?: string
    seedAdminClerkUserId?: string
  } = {}
): Promise<AccessBootstrapResult> {
  const adminBefore = await db.role.findUnique({
    where: { name: "ADMIN" },
    select: {
      id: true,
      _count: { select: { permissions: true } },
    },
  })
  const needsRbac = !adminBefore || adminBefore._count.permissions === 0
  // Always upsert RBAC — cheap and heals partial / empty catalogs that cause dashboard 403.
  await seedPermissionsAndRoles(db)

  const adminClerkUserIds = parseClerkUserIds(options.seedAdminClerkUserId, options.bootstrapAdminClerkUserIds)

  const promoted: string[] = []
  const alreadyAdmin: string[] = []
  const failed: Array<{ clerkUserId: string; reason: string }> = []

  for (const clerkUserId of adminClerkUserIds) {
    const user = await db.user.upsert({
      where: { clerkUserId },
      create: {
        clerkUserId,
        email: `${clerkUserId}@clerk.local`,
        fullName: "Bootstrap Admin",
        isActive: true,
      },
      update: {
        isActive: true,
      },
    })

    const result = await promoteUserToAdmin(db, user.id)
    if (result.status === "admin-role-not-found") {
      failed.push({ clerkUserId, reason: "ADMIN role not found" })
      continue
    }
    if (result.status === "already-admin") {
      alreadyAdmin.push(clerkUserId)
      continue
    }
    promoted.push(clerkUserId)
  }

  return {
    rbacEnsured: needsRbac,
    adminClerkUserIds,
    promoted,
    alreadyAdmin,
    failed,
  }
}
