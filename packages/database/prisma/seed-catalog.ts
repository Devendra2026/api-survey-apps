import { PrismaClient, UlbType } from "../src/generated/prisma/client.js"
import { seedPermissionsAndRoles, type RoleMap } from "../src/rbac-catalog.js"
import { seedReferenceCatalogs } from "./seed-reference-catalogs.js"

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
      code: "ETA",
    },
    update: { code: "ETA" },
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
