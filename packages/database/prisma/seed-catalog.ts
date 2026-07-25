import { PrismaClient, UlbType } from "../src/generated/prisma/client.js"
import { seedReferenceCatalogs } from "./seed-reference-catalogs.js"

// -----------------------------------------------------------------------------
// RBAC catalog
// -----------------------------------------------------------------------------

const PERMISSIONS: Array<{ name: string; description: string }> = [
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

const ROLE_PERMISSIONS: Record<string, string[]> = {
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
  ADMIN: PERMISSIONS.map((p) => p.name),
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval — waiting for Admin role assignment",
  SURVEYOR: "Field surveyor capturing property tax surveys",
  FIELD_SUPERVISOR: "Supervises field surveyors and assignments",
  QC_SUPERVISOR: "Quality-control review and approve/reject",
  ADMIN: "Full system administration",
}

type RoleMap = Record<string, { id: string; name: string }>

async function seedPermissionsAndRoles(db: PrismaClient): Promise<RoleMap> {
  for (const permission of PERMISSIONS) {
    await db.permission.upsert({
      where: { name: permission.name },
      create: permission,
      update: { description: permission.description },
    })
  }

  const permissionByName = Object.fromEntries((await db.permission.findMany()).map((p) => [p.name, p.id]))

  const roles: RoleMap = {}

  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await db.role.upsert({
      where: { name: roleName },
      create: {
        name: roleName,
        description: ROLE_DESCRIPTIONS[roleName],
      },
      update: {
        description: ROLE_DESCRIPTIONS[roleName],
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

  console.log(`Seeded ${PERMISSIONS.length} permissions and ${Object.keys(ROLE_PERMISSIONS).length} roles`)

  return roles
}

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

// -----------------------------------------------------------------------------
// Geography (Uttar Pradesh / Etah)
// -----------------------------------------------------------------------------

type Geography = {
  state: { id: string }
  district: { id: string }
  ulb: { id: string }
  wards: { ward1: { id: string }; ward2: { id: string } }
}

async function seedGeography(db: PrismaClient): Promise<Geography> {
  const state = await db.state.upsert({
    where: { code: "UP" },
    create: { name: "Uttar Pradesh", code: "UP" },
    update: { name: "Uttar Pradesh" },
  })

  const district = await db.district.upsert({
    where: {
      stateId_name: {
        stateId: state.id,
        name: "Etah",
      },
    },
    create: {
      stateId: state.id,
      name: "Etah",
    },
    update: {},
  })

  const ulb = await db.ulb.upsert({
    where: {
      districtId_name: {
        districtId: district.id,
        name: "Etah Municipal Corporation",
      },
    },
    create: {
      districtId: district.id,
      name: "Etah Municipal Corporation",
      code: "ETM",
      type: UlbType.MUNICIPAL_COUNCIL,
    },
    update: {
      code: "ETM",
      type: UlbType.MUNICIPAL_COUNCIL,
    },
  })

  const ward1 = await db.ward.upsert({
    where: {
      ulbId_wardNumber: {
        ulbId: ulb.id,
        wardNumber: "1",
      },
    },
    create: {
      ulbId: ulb.id,
      wardNumber: "1",
      wardName: "Ward 1 - Etah",
    },
    update: {
      wardName: "Ward 1 - Etah",
    },
  })

  const ward2 = await db.ward.upsert({
    where: {
      ulbId_wardNumber: {
        ulbId: ulb.id,
        wardNumber: "2",
      },
    },
    create: {
      ulbId: ulb.id,
      wardNumber: "2",
      wardName: "Ward 2 - Etah",
    },
    update: {
      wardName: "Ward 2 - Etah",
    },
  })

  console.log("Seeded geography: Uttar Pradesh → Etah → Etah Municipal Corporation → wards 1, 2")

  return {
    state,
    district,
    ulb,
    wards: { ward1, ward2 },
  }
}

export async function seedCatalog(db: PrismaClient) {
  const roles = await seedPermissionsAndRoles(db)
  const geo = await seedGeography(db)
  await seedReferenceCatalogs(db)
  return { roles, geo }
}
