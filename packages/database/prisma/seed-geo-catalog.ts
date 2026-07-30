/**
 * Optional geo catalog seed helper.
 * Prefer POST /imports/geo-catalog for production LGD data.
 * This documents the expected CSV shape and can upsert a minimal example.
 *
 * CSV columns:
 * State Code, State Name, District Code?, District Name, ULB Code, ULB Name, ULB Type, Ward Number, Ward Name
 */
import { UlbType, type PrismaClient } from "../src/generated/prisma/client.js"

export async function seedGeoCatalogExample(db: PrismaClient) {
  const state = await db.state.upsert({
    where: { code: "UP" },
    create: { code: "UP", name: "Uttar Pradesh" },
    update: { name: "Uttar Pradesh" },
  })

  const district = await db.district.upsert({
    where: { stateId_name: { stateId: state.id, name: "Example District" } },
    create: { stateId: state.id, name: "Example District", code: "EXD" },
    update: { code: "EXD" },
  })

  // Example LGD-style code used in import workbooks (replace with real catalog).
  const existing = await db.ulb.findFirst({ where: { code: "800726" } })
  const ulb =
    existing ??
    (await db.ulb.create({
      data: {
        districtId: district.id,
        name: "Example ULB 800726",
        code: "800726",
        type: UlbType.MUNICIPAL_COUNCIL,
      },
    }))

  const existingWard = await db.ward.findFirst({
    where: { ulbId: ulb.id, wardNumber: "5", deletedAt: null },
  })
  if (existingWard) {
    await db.ward.update({
      where: { id: existingWard.id },
      data: { wardName: "Ward 5" },
    })
  } else {
    await db.ward.create({
      data: { ulbId: ulb.id, wardNumber: "5", wardName: "Ward 5" },
    })
  }

  return { state, district, ulb }
}
