import type { PrismaClient } from "./generated/prisma/client.js"
import type { TransactionClient } from "./generated/prisma/internal/prismaNamespace.js"

export type AdminPromotionResult =
  | { status: "promoted"; userId: string; adminAssignmentId: string }
  | { status: "already-admin"; userId: string; adminAssignmentId: string }
  | { status: "user-not-found" }
  | { status: "admin-role-not-found" }

type PromotionResult = Exclude<AdminPromotionResult, { status: "user-not-found" }>

async function assignAdminRole(tx: TransactionClient, userId: string, adminRoleId: string): Promise<PromotionResult> {
  await tx.userTenantRole.updateMany({
    where: {
      userId,
      isActive: true,
      roleId: { not: adminRoleId },
    },
    data: {
      isActive: false,
      deactivatedBy: userId,
      deactivatedAt: new Date(),
    },
  })

  const existingAdmin = await tx.userTenantRole.findFirst({
    where: { userId, roleId: adminRoleId, isActive: true },
    select: { id: true },
  })
  if (existingAdmin) {
    return {
      status: "already-admin",
      userId,
      adminAssignmentId: existingAdmin.id,
    }
  }

  const adminAssignment = await tx.userTenantRole.create({
    data: {
      userId,
      roleId: adminRoleId,
      assignedBy: userId,
      stateId: null,
      districtId: null,
      ulbId: null,
      wardId: null,
      isActive: true,
    },
    select: { id: true },
  })
  return {
    status: "promoted",
    userId,
    adminAssignmentId: adminAssignment.id,
  }
}

export async function promoteUserToAdmin(prisma: PrismaClient, userId: string): Promise<PromotionResult> {
  const adminRole = await prisma.role.findUnique({
    where: { name: "ADMIN" },
    select: { id: true },
  })
  if (!adminRole) {
    return { status: "admin-role-not-found" }
  }

  return prisma.$transaction((tx) => assignAdminRole(tx, userId, adminRole.id))
}

export async function promoteClerkUserToAdmin(
  prisma: PrismaClient,
  clerkUserId: string
): Promise<AdminPromotionResult> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  })
  if (!user) {
    return { status: "user-not-found" }
  }

  return promoteUserToAdmin(prisma, user.id)
}
