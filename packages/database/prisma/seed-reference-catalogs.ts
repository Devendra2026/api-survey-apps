import type { PrismaClient } from "../src/generated/prisma/client.js"

type CatalogSeed = {
  code: string
  name: string
  description: string
  iconKey: string
  entries: Array<{ code: string; name: string; description?: string; value?: string }>
}

const CATALOGS: CatalogSeed[] = [
  {
    code: "ASSESSMENT_YEAR",
    name: "Assessment Years",
    description: "Financial assessment years for surveys and tax configurations",
    iconKey: "Calendar",
    entries: [
      { code: "AY_2025_2026", name: "2025-2026", value: "2025-2026" },
      { code: "AY_2026_2027", name: "2026-2027", value: "2026-2027" },
    ],
  },
  {
    code: "OWNERSHIP_TYPE",
    name: "Ownership Types",
    description: "Legal ownership classification for properties",
    iconKey: "Users",
    entries: [
      { code: "INDIVIDUAL", name: "Individual" },
      { code: "JOINT", name: "Joint" },
      { code: "LIMITED_COMPANY_FIRM", name: "Limited Company / Firm" },
      { code: "TRUST_SOCIETY", name: "Trust / Society" },
      { code: "RELIGIOUS_BODY", name: "Religious Body" },
      { code: "STATE_GOVERNMENT_BODY", name: "State Government Body" },
      { code: "CENTRAL_GOVERNMENT_BODY", name: "Central Government Body" },
      { code: "MUNICIPAL_COUNCIL_TOWN_PANCHAYAT", name: "Municipal Council / Town Panchayat" },
      { code: "LEASE_PROPERTY", name: "Lease Property" },
    ],
  },
  {
    code: "PROPERTY_USE",
    name: "Property Uses",
    description: "Primary use classification",
    iconKey: "Building2",
    entries: [
      { code: "RESIDENTIAL", name: "Residential" },
      { code: "COMMERCIAL", name: "Commercial" },
      { code: "OPEN_LAND", name: "Open Land" },
      { code: "RELIGIOUS_PROPERTY", name: "Religious Property" },
      { code: "MIX_PROPERTY", name: "Mixed Property" },
    ],
  },
  {
    code: "PROPERTY_TYPE",
    name: "Property Types",
    description: "Detailed property type for assessment",
    iconKey: "Home",
    entries: [
      { code: "RESIDENTIAL_SELF", name: "Residential Self" },
      { code: "RESIDENTIAL_RENTED", name: "Residential Rented" },
      { code: "SHOP_BAKERY", name: "Shop / Bakery" },
      { code: "BANK_OFFICE", name: "Bank / Office" },
      { code: "SCHOOL_COLLEGE", name: "School / College" },
      { code: "MALL_SHOWROOM", name: "Mall / Showroom" },
      { code: "PETROL_PUMP", name: "Petrol Pump" },
      { code: "HOTEL_MARRIAGE_RESTAURANT", name: "Hotel / Marriage / Restaurant" },
      { code: "HOSPITAL_NURSING_PATHOLOGY", name: "Hospital / Nursing / Pathology" },
      { code: "GODOWN", name: "Godown" },
      { code: "CENTRAL_GOVERNMENT", name: "Central Government" },
      { code: "STATE_GOVERNMENT", name: "State Government" },
      { code: "INDUSTRY", name: "Industry" },
      { code: "COLD_STORE", name: "Cold Store" },
      { code: "OPEN", name: "Open" },
      { code: "AGRICULTURE", name: "Agriculture" },
      { code: "OPEN_LAND_GODOWN", name: "Open Land Godown" },
      { code: "MANDIR", name: "Mandir" },
      { code: "MASJID", name: "Masjid" },
      { code: "TRUST_DHARAMSHALA", name: "Trust / Dharamshala" },
      { code: "SHAMSHAN_KABRISTAN", name: "Shamshan / Kabristan" },
      { code: "GURUDWARA_CHURCH", name: "Gurudwara / Church" },
      { code: "RESIDENTIAL_AND_COMMERCIAL", name: "Residential and Commercial" },
    ],
  },
  {
    code: "ROAD_TYPE",
    name: "Road Types",
    description: "Approach road surface classification",
    iconKey: "Route",
    entries: [
      { code: "RCC", name: "RCC" },
      { code: "DAMBAR", name: "Dambar" },
      { code: "KACCHA", name: "Kaccha" },
    ],
  },
  {
    code: "TAX_RATE_ZONE",
    name: "Road Width / Tax Zones",
    description: "Road-width buckets used by the tax rate matrix",
    iconKey: "Ruler",
    entries: [
      { code: "BELOW_9M", name: "Below 9m", value: "<9m" },
      { code: "METER_9_TO_12", name: "9m to 12m", value: "9-12m" },
      { code: "METER_12_TO_24", name: "12m to 24m", value: "12-24m" },
      { code: "ABOVE_24M", name: "Above 24m", value: ">24m" },
    ],
  },
  {
    code: "CONSTRUCTION_TYPE",
    name: "Construction Types",
    description: "Floor construction classification for rate matrix columns",
    iconKey: "Hammer",
    entries: [
      { code: "PAKKA_BUILDING_WITH_RCC_ROOF", name: "RCC / Pakka", value: "RCC" },
      { code: "TIN_SHED", name: "Tin Shed", value: "TIN" },
      { code: "KACCHA_BUILDING", name: "Kachcha", value: "KACHCHA" },
      { code: "OPEN_LAND", name: "Open Land", value: "OPEN" },
      { code: "UNDER_CONSTRUCTION", name: "Under Construction", value: "UC" },
    ],
  },
  {
    code: "SITUATION",
    name: "Situations",
    description: "Property situation relative to market and roads",
    iconKey: "MapPin",
    entries: [
      { code: "MAIN_MARKET", name: "Main Market" },
      { code: "MAIN_ROAD", name: "Main Road" },
      { code: "INTERIOR", name: "Interior" },
    ],
  },
  {
    code: "USAGE_FACTOR",
    name: "Usage Factors",
    description: "Usage factor for floor-level assessment",
    iconKey: "Layers",
    entries: [
      { code: "RESIDENTIAL", name: "Residential" },
      { code: "COMMERCIAL", name: "Commercial" },
      { code: "MIXED", name: "Mixed" },
      { code: "AGRICULTURE", name: "Agriculture" },
      { code: "GODOWN", name: "Godown" },
      { code: "OPEN_LAND", name: "Open Land" },
      { code: "UNDER_CONSTRUCTION", name: "Under Construction" },
    ],
  },
  {
    code: "USAGE_TYPE",
    name: "Usage Types",
    description: "Self-occupied vs rented",
    iconKey: "KeyRound",
    entries: [
      { code: "SELF_OCCUPIED", name: "Self Occupied" },
      { code: "RENTED", name: "Rented" },
    ],
  },
  {
    code: "OCCUPANCY_TYPE",
    name: "Occupancy Types",
    description: "Controlled occupancy values (replaces free-text floor occupancy)",
    iconKey: "DoorOpen",
    entries: [
      { code: "OWNER", name: "Owner Occupied" },
      { code: "TENANT", name: "Tenant" },
      { code: "VACANT", name: "Vacant" },
      { code: "MIXED", name: "Mixed" },
    ],
  },
]

export async function seedReferenceCatalogs(db: PrismaClient): Promise<void> {
  for (const catalog of CATALOGS) {
    const category = await db.referenceCategory.upsert({
      where: { code: catalog.code },
      create: {
        code: catalog.code,
        name: catalog.name,
        description: catalog.description,
        iconKey: catalog.iconKey,
        isSystem: true,
      },
      update: {
        name: catalog.name,
        description: catalog.description,
        iconKey: catalog.iconKey,
        isSystem: true,
      },
    })

    for (let i = 0; i < catalog.entries.length; i++) {
      const entry = catalog.entries[i]!
      await db.referenceEntry.upsert({
        where: {
          categoryId_code: {
            categoryId: category.id,
            code: entry.code,
          },
        },
        create: {
          categoryId: category.id,
          code: entry.code,
          name: entry.name,
          description: entry.description,
          value: entry.value,
          sortOrder: i,
          status: "ACTIVE",
        },
        update: {
          name: entry.name,
          description: entry.description,
          value: entry.value,
          sortOrder: i,
        },
      })
    }
  }

  console.log(`Seeded ${CATALOGS.length} reference categories`)
}
