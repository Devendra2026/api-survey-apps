import type { PrismaClient } from "./generated/prisma/client.js"

export const RBAC_PERMISSIONS: Array<{ name: string; description: string }> = [
  { name: "survey:create", description: "Create surveys" },
  { name: "survey:update", description: "Update surveys" },
  { name: "survey:delete", description: "Soft-delete surveys" },
  { name: "survey:view", description: "View surveys" },
  { name: "survey:submit", description: "Submit surveys for review" },
  { name: "survey:approve", description: "Approve surveys" },
  { name: "survey:reject", description: "Reject surveys" },
  { name: "survey:assign", description: "Assign survey work" },
  { name: "survey:export", description: "Export survey data" },
  { name: "survey:import", description: "Import survey data" },
  { name: "etl:manage", description: "Run and monitor Convex→Postgres ETL migration" },
  { name: "user:create", description: "Create users" },
  { name: "user:update", description: "Update users" },
  { name: "user:delete", description: "Deactivate users" },
  { name: "user:view", description: "View users" },
  { name: "user:reset_password", description: "Reset user passwords via identity provider" },
  { name: "role:assign", description: "Assign tenant roles" },
  { name: "dashboard:view", description: "View dashboards" },
  { name: "report:view", description: "View reports" },
  { name: "report:export", description: "Export reports" },
  { name: "photo:create", description: "Create survey photos" },
  { name: "photo:update", description: "Update survey photos" },
  { name: "photo:delete", description: "Delete survey photos" },
  { name: "settings:view", description: "View system settings" },
  { name: "settings:manage", description: "Manage system settings" },
  { name: "settings:publish", description: "Publish and rollback tax configuration" },
]

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  PENDING_APPROVAL: [],
  SURVEYOR: [
    "survey:create",
    "survey:update",
    "survey:view",
    "survey:submit",
    "photo:create",
    "photo:update",
    "photo:delete",
    "dashboard:view",
  ],
  FIELD_SUPERVISOR: [
    "survey:create",
    "survey:update",
    "survey:view",
    "survey:submit",
    "survey:assign",
    "survey:reject",
    "photo:create",
    "photo:update",
    "photo:delete",
    "user:view",
    "dashboard:view",
    "report:view",
  ],
  QC_SUPERVISOR: [
    "survey:view",
    "survey:update",
    "survey:approve",
    "survey:reject",
    "photo:update",
    "photo:delete",
    "user:view",
    "dashboard:view",
    "report:view",
  ],
  ADMIN: RBAC_PERMISSIONS.map((p) => p.name),
  DEPT_ADMIN: [
    "user:view",
    "user:create",
    "user:update",
    "role:assign",
    "dashboard:view",
    "survey:view",
    "report:view",
    "report:export",
  ],
  DEPT_CLERK: ["user:view", "survey:view", "survey:update", "report:view", "dashboard:view"],
  DEPT_OPERATOR: ["survey:create", "survey:submit", "survey:view", "photo:create", "dashboard:view"],
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval — waiting for Admin role assignment",
  SURVEYOR: "Field surveyor capturing property tax surveys",
  FIELD_SUPERVISOR: "Supervises field surveyors and assignments",
  QC_SUPERVISOR: "Quality-control review and approve/reject",
  ADMIN: "Full system administration",
  DEPT_ADMIN: "Municipal department admin — manages users and roles within their ULB",
  DEPT_CLERK: "Municipal clerk — office review and reporting within their ULB",
  DEPT_OPERATOR: "Municipal operator — field survey capture within their ULB",
}

const DEPARTMENT_ROLES = new Set(["DEPT_ADMIN", "DEPT_CLERK", "DEPT_OPERATOR"])

export type RoleMap = Record<string, { id: string; name: string }>

/** Reassign OPERATION_MANAGER assignments to ADMIN, then remove the legacy role. */
async function migrateOperationManagerRole(db: PrismaClient, roles: RoleMap) {
  const omRole = await db.role.findUnique({ where: { name: "OPERATION_MANAGER" } })
  if (!omRole) return

  const adminRole = roles.ADMIN
  if (!adminRole) {
    throw new Error("ADMIN role missing — cannot migrate OPERATION_MANAGER")
  }

  const omAssignments = await db.userTenantRole.findMany({
    where: { roleId: omRole.id },
  })

  for (const assignment of omAssignments) {
    if (assignment.isActive) {
      await db.userTenantRole.update({
        where: { id: assignment.id },
        data: { roleId: adminRole.id },
      })
    } else {
      await db.userTenantRole.delete({ where: { id: assignment.id } })
    }
  }

  await db.rolePermission.deleteMany({ where: { roleId: omRole.id } })
  await db.role.delete({ where: { id: omRole.id } })
  console.log(`Migrated ${omAssignments.length} OPERATION_MANAGER assignment(s) → ADMIN and removed role`)
}

/** Idempotent permissions + roles upsert used by seed and API startup. */
export async function seedPermissionsAndRoles(db: PrismaClient): Promise<RoleMap> {
  for (const permission of RBAC_PERMISSIONS) {
    await db.permission.upsert({
      where: { name: permission.name },
      create: permission,
      update: { description: permission.description },
    })
  }

  const permissionByName = Object.fromEntries((await db.permission.findMany()).map((p) => [p.name, p.id]))

  const roles: RoleMap = {}

  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
    const family = DEPARTMENT_ROLES.has(roleName) ? "DEPARTMENT" : "PLATFORM"
    const role = await db.role.upsert({
      where: { name: roleName },
      create: {
        name: roleName,
        description: ROLE_DESCRIPTIONS[roleName],
        family,
      },
      update: {
        description: ROLE_DESCRIPTIONS[roleName],
        family,
      },
    })

    roles[roleName] = role

    for (const permissionName of permissionNames) {
      const permissionId = permissionByName[permissionName]
      if (!permissionId) {
        throw new Error(`Missing permission: ${permissionName}`)
      }

      await db.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId,
          },
        },
        create: {
          roleId: role.id,
          permissionId,
        },
        update: {},
      })
    }
  }

  await migrateOperationManagerRole(db, roles)

  console.log(`Seeded ${RBAC_PERMISSIONS.length} permissions and ${Object.keys(ROLE_PERMISSIONS).length} roles`)

  return roles
}
