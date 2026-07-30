import { PrismaClient, UlbType } from "../src/generated/prisma/client.js"
import { seedPermissionsAndRoles } from "../src/rbac-catalog.js"
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

  const upsertActiveWard = async (wardNumber: string, wardName: string) => {
    const existing = await db.ward.findFirst({
      where: { ulbId: ulb.id, wardNumber, deletedAt: null },
    })
    if (existing) {
      return db.ward.update({
        where: { id: existing.id },
        data: { wardName },
      })
    }
    return db.ward.create({
      data: { ulbId: ulb.id, wardNumber, wardName },
    })
  }

  const ward1 = await upsertActiveWard("1", "Ward 1 - Etah")
  const ward2 = await upsertActiveWard("2", "Ward 2 - Etah")

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
