import { PrismaPg } from "@prisma/adapter-pg"
import { loadRootEnv } from "../load-root-env.js"
import {
  AssessmentYear,
  ConstructionType,
  FloorPosition,
  OwnershipType,
  PhotoType,
  PrismaClient,
  PropertyType,
  PropertyUse,
  RoadType,
  SanitationType,
  Situation,
  SourceOfWater,
  SurveyStatus,
  TaxRateZone,
  UlbType,
  WaterConnection,
  usageFactor,
  usageType,
} from "../src/generated/prisma/client.js"

loadRootEnv(import.meta.url)

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL is not set")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
})

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
  { name: "user:create", description: "Create users" },
  { name: "user:update", description: "Update users" },
  { name: "user:delete", description: "Deactivate users" },
  { name: "user:view", description: "View users" },
  { name: "role:assign", description: "Assign tenant roles" },
  { name: "dashboard:view", description: "View dashboards" },
  { name: "report:view", description: "View reports" },
  { name: "report:export", description: "Export reports" },
  { name: "photo:create", description: "Create survey photos" },
  { name: "photo:update", description: "Update survey photos" },
  { name: "photo:delete", description: "Delete survey photos" },
]

const ROLE_PERMISSIONS: Record<string, string[]> = {
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
    "dashboard:view",
    "report:view",
  ],
  OPERATION_MANAGER: [
    "survey:view",
    "survey:approve",
    "survey:reject",
    "survey:assign",
    "user:view",
    "user:update",
    "role:assign",
    "dashboard:view",
    "report:view",
    "report:export",
  ],
  ADMIN: PERMISSIONS.map((p) => p.name),
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval for survey submission",
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

  console.log(`Seeded ${PERMISSIONS.length} permissions and ${Object.keys(ROLE_PERMISSIONS).length} roles`)

  return roles
}

// -----------------------------------------------------------------------------
// Geography
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

  console.log("Seeded geography: Telangana → Hyderabad → GHMC → wards 1, 2")

  return {
    state,
    district,
    ulb,
    wards: { ward1, ward2 },
  }
}

// -----------------------------------------------------------------------------
// Users + tenant roles
// -----------------------------------------------------------------------------

type SeedUsers = {
  admin: { id: string }
  surveyor: { id: string }
  fieldSupervisor: { id: string }
  qcSupervisor: { id: string }
}

async function ensureTenantRole(
  db: PrismaClient,
  data: {
    userId: string
    roleId: string
    assignedBy: string
    stateId?: string | null
    districtId?: string | null
    ulbId?: string | null
    wardId?: string | null
  }
) {
  const existing = await db.userTenantRole.findFirst({
    where: {
      userId: data.userId,
      roleId: data.roleId,
      stateId: data.stateId ?? null,
      districtId: data.districtId ?? null,
      ulbId: data.ulbId ?? null,
      wardId: data.wardId ?? null,
      isActive: true,
    },
  })

  if (existing) {
    return existing
  }

  return db.userTenantRole.create({
    data: {
      userId: data.userId,
      roleId: data.roleId,
      assignedBy: data.assignedBy,
      stateId: data.stateId ?? null,
      districtId: data.districtId ?? null,
      ulbId: data.ulbId ?? null,
      wardId: data.wardId ?? null,
      isActive: true,
    },
  })
}

async function seedUsersAndTenantRoles(db: PrismaClient, geo: Geography, roles: RoleMap): Promise<SeedUsers> {
  const adminRole = roles.ADMIN
  const surveyorRole = roles.SURVEYOR
  const fieldSupervisorRole = roles.FIELD_SUPERVISOR
  const qcSupervisorRole = roles.QC_SUPERVISOR

  if (!adminRole || !surveyorRole || !fieldSupervisorRole || !qcSupervisorRole) {
    throw new Error("Required roles missing after RBAC seed")
  }

  const admin = await db.user.upsert({
    where: { clerkUserId: "user_seed_admin" },
    create: {
      clerkUserId: "user_seed_admin",
      email: "sikarwar2002@gmail.com",
      fullName: "Tarun Sikarwar",
      phone: "9760091446",
      isActive: true,
    },
    update: {
      email: "sikarwar2002@gmail.com",
      fullName: "Tarun Sikarwar",
      phone: "9760091446",
      isActive: true,
    },
  })

  const surveyor = await db.user.upsert({
    where: { clerkUserId: "user_seed_surveyor" },
    create: {
      clerkUserId: "user_seed_surveyor",
      email: "surveyor@seed.local",
      fullName: "Seed Surveyor",
      phone: "9000000002",
      isActive: true,
    },
    update: {
      email: "surveyor@seed.local",
      fullName: "Seed Surveyor",
      phone: "9000000002",
      isActive: true,
    },
  })

  const fieldSupervisor = await db.user.upsert({
    where: { clerkUserId: "user_seed_field_supervisor" },
    create: {
      clerkUserId: "user_seed_field_supervisor",
      email: "field.supervisor@seed.local",
      fullName: "Seed Field Supervisor",
      phone: "9000000003",
      isActive: true,
    },
    update: {
      email: "field.supervisor@seed.local",
      fullName: "Seed Field Supervisor",
      phone: "9000000003",
      isActive: true,
    },
  })

  const qcSupervisor = await db.user.upsert({
    where: { clerkUserId: "user_seed_qc_supervisor" },
    create: {
      clerkUserId: "user_seed_qc_supervisor",
      email: "qc.supervisor@seed.local",
      fullName: "Seed QC Supervisor",
      phone: "9000000004",
      isActive: true,
    },
    update: {
      email: "qc.supervisor@seed.local",
      fullName: "Seed QC Supervisor",
      phone: "9000000004",
      isActive: true,
    },
  })

  await ensureTenantRole(db, {
    userId: admin.id,
    roleId: adminRole.id,
    assignedBy: admin.id,
    stateId: geo.state.id,
  })

  await ensureTenantRole(db, {
    userId: surveyor.id,
    roleId: surveyorRole.id,
    assignedBy: admin.id,
    stateId: geo.state.id,
    districtId: geo.district.id,
    ulbId: geo.ulb.id,
    wardId: geo.wards.ward1.id,
  })

  await ensureTenantRole(db, {
    userId: fieldSupervisor.id,
    roleId: fieldSupervisorRole.id,
    assignedBy: admin.id,
    stateId: geo.state.id,
    districtId: geo.district.id,
    ulbId: geo.ulb.id,
  })

  await ensureTenantRole(db, {
    userId: qcSupervisor.id,
    roleId: qcSupervisorRole.id,
    assignedBy: admin.id,
    stateId: geo.state.id,
    districtId: geo.district.id,
    ulbId: geo.ulb.id,
  })

  const seedAdminClerkId = process.env.SEED_ADMIN_CLERK_USER_ID?.trim()
  if (seedAdminClerkId) {
    const realAdmin = await db.user.upsert({
      where: { clerkUserId: seedAdminClerkId },
      create: {
        clerkUserId: seedAdminClerkId,
        email: `${seedAdminClerkId}@clerk.local`,
        fullName: "Bootstrap Admin",
        isActive: true,
      },
      update: {
        isActive: true,
      },
    })

    await ensureTenantRole(db, {
      userId: realAdmin.id,
      roleId: adminRole.id,
      assignedBy: admin.id,
      // null geo = global ADMIN (isGlobal: true)
    })

    console.log(`Seeded real Clerk admin clerkUserId=${seedAdminClerkId} as global ADMIN`)
  }

  console.log("Seeded 4 demo users and tenant role assignments")

  return { admin, surveyor, fieldSupervisor, qcSupervisor }
}

// -----------------------------------------------------------------------------
// Sample surveys
// -----------------------------------------------------------------------------

async function seedSampleSurveys(db: PrismaClient, geo: Geography, users: SeedUsers) {
  const sharedGeo = {
    stateId: geo.state.id,
    districtId: geo.district.id,
    ulbId: geo.ulb.id,
    wardId: geo.wards.ward1.id,
    createdById: users.surveyor.id,
    wardNumber: "1",
    ulbCode: "GHMC",
    districtName: "Hyderabad",
  }

  const draft = await db.survey.upsert({
    where: { propertyId: "SEED-PROP-001" },
    create: {
      ...sharedGeo,
      propertyId: "SEED-PROP-001",
      localId: "LOC-001",
      respondentName: "Ramesh Kumar",
      relationshipWithOwner: "Self",
      mobileNumber: "9876543210",
      houseDoorNo: "12-3-45",
      locality: "Etah",
      colony: "Bank Street",
      city: "Etah",
      pinCode: "500001",
      ownershipType: OwnershipType.INDIVIDUAL,
      propertyUse: PropertyUse.RESIDENTIAL,
      propertyType: PropertyType.RESIDENTIAL_SELF,
      situation: Situation.INTERIOR,
      roadType: RoadType.RCC,
      taxRateZone: TaxRateZone.METER_9_TO_12,
      assessmentYear: AssessmentYear.AY_2025_2026,
      plotAreaSqFt: 1200,
      plotAreaSqMeter: 111.4836,
      plinthAreaSqFt: 900,
      plinthAreaSqMeter: 83.6127,
      totalBuiltAreaSqFt: 900,
      totalBuiltAreaSqMeter: 83.6127,
      waterConnection: WaterConnection.YES,
      sourceOfWater: SourceOfWater.GOVERNMENT_TAP,
      sanitationType: SanitationType.SEWER_SYSTEM,
      solidWasteCollection: true,
      surveyStatus: SurveyStatus.DRAFT,
    },
    update: {
      respondentName: "Ramesh Kumar",
      surveyStatus: SurveyStatus.DRAFT,
      ownershipType: OwnershipType.INDIVIDUAL,
      propertyUse: PropertyUse.RESIDENTIAL,
      propertyType: PropertyType.RESIDENTIAL_SELF,
    },
  })

  const submitted = await db.survey.upsert({
    where: { propertyId: "SEED-PROP-002" },
    create: {
      ...sharedGeo,
      propertyId: "SEED-PROP-002",
      localId: "LOC-002",
      respondentName: "Sita Devi",
      relationshipWithOwner: "Owner",
      mobileNumber: "9876543211",
      alternateMobile: "9876543212",
      familySize: 4,
      houseDoorNo: "8-2-10",
      locality: "Etah",
      colony: "Troop Bazaar",
      city: "Etah",
      pinCode: "500001",
      ownershipType: OwnershipType.JOINT,
      propertyUse: PropertyUse.MIX_PROPERTY,
      propertyType: PropertyType.RESIDENTIAL_AND_COMMERCIAL,
      situation: Situation.MAIN_ROAD,
      roadType: RoadType.DAMBAR,
      taxRateZone: TaxRateZone.METER_12_TO_24,
      assessmentYear: AssessmentYear.AY_2025_2026,
      plotAreaSqFt: 2400,
      plotAreaSqMeter: 222.9672,
      plinthAreaSqFt: 1800,
      plinthAreaSqMeter: 167.2254,
      totalBuiltAreaSqFt: 3200,
      totalBuiltAreaSqMeter: 297.2896,
      waterConnection: WaterConnection.PARTIAL,
      sourceOfWater: SourceOfWater.BOREWELL,
      sanitationType: SanitationType.SEPTIC_TANK,
      solidWasteCollection: true,
      surveyStatus: SurveyStatus.SUBMITTED,
      submittedAt: new Date("2026-06-01T10:00:00.000Z"),
    },
    update: {
      respondentName: "Sita Devi",
      surveyStatus: SurveyStatus.SUBMITTED,
      submittedAt: new Date("2026-06-01T10:00:00.000Z"),
      ownershipType: OwnershipType.JOINT,
      propertyUse: PropertyUse.MIX_PROPERTY,
      propertyType: PropertyType.RESIDENTIAL_AND_COMMERCIAL,
    },
  })

  const approved = await db.survey.upsert({
    where: { propertyId: "SEED-PROP-003" },
    create: {
      ...sharedGeo,
      propertyId: "SEED-PROP-003",
      localId: "LOC-003",
      respondentName: "Mohan Traders",
      relationshipWithOwner: "Authorized Signatory",
      mobileNumber: "9876543213",
      houseDoorNo: "5-1-100",
      locality: "Etah",
      colony: "Nampally",
      city: "Etah",
      pinCode: "500001",
      ownershipType: OwnershipType.LIMITED_COMPANY_FIRM,
      propertyUse: PropertyUse.COMMERCIAL,
      propertyType: PropertyType.SHOP_BAKERY,
      situation: Situation.MAIN_MARKET,
      roadType: RoadType.RCC,
      taxRateZone: TaxRateZone.ABOVE_24M,
      assessmentYear: AssessmentYear.AY_2026_2027,
      plotAreaSqFt: 800,
      plotAreaSqMeter: 74.3224,
      plinthAreaSqFt: 750,
      plinthAreaSqMeter: 69.6772,
      totalBuiltAreaSqFt: 750,
      totalBuiltAreaSqMeter: 69.6772,
      waterConnection: WaterConnection.YES,
      sourceOfWater: SourceOfWater.GOVERNMENT_TAP,
      sanitationType: SanitationType.SEWER_SYSTEM,
      solidWasteCollection: true,
      surveyStatus: SurveyStatus.APPROVED,
      submittedAt: new Date("2026-05-15T09:00:00.000Z"),
      approvedAt: new Date("2026-05-20T14:30:00.000Z"),
      qcRemarks: "Verified on site; measurements match",
    },
    update: {
      respondentName: "Mohan Traders",
      surveyStatus: SurveyStatus.APPROVED,
      submittedAt: new Date("2026-05-15T09:00:00.000Z"),
      approvedAt: new Date("2026-05-20T14:30:00.000Z"),
      qcRemarks: "Verified on site; measurements match",
      ownershipType: OwnershipType.LIMITED_COMPANY_FIRM,
      propertyUse: PropertyUse.COMMERCIAL,
      propertyType: PropertyType.SHOP_BAKERY,
    },
  })

  const surveys = [draft, submitted, approved]

  for (const survey of surveys) {
    await db.coOwner.deleteMany({ where: { surveyId: survey.id } })
    await db.floor.deleteMany({ where: { surveyId: survey.id } })
    await db.photo.deleteMany({ where: { surveyId: survey.id } })
    await db.surveyAudit.deleteMany({ where: { surveyId: survey.id } })
  }

  await db.coOwner.createMany({
    data: [
      {
        surveyId: draft.id,
        name: "Ramesh Kumar",
        fatherOrHusbandName: "Suresh Kumar",
        mobile: "9876543210",
      },
      {
        surveyId: submitted.id,
        name: "Sita Devi",
        fatherOrHusbandName: "Ravi Prasad",
        mobile: "9876543211",
      },
      {
        surveyId: submitted.id,
        name: "Ravi Prasad",
        fatherOrHusbandName: "Late Krishna Prasad",
        mobile: "9876543212",
      },
      {
        surveyId: approved.id,
        name: "Mohan Lal",
        fatherOrHusbandName: "Gopal Lal",
        mobile: "9876543213",
      },
    ],
  })

  await db.floor.createMany({
    data: [
      {
        surveyId: draft.id,
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: usageFactor.RESIDENTIAL,
        usageType: usageType.SELF_OCCUPIED,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        occupancy: "Occupied",
        areaSqFt: 900,
      },
      {
        surveyId: submitted.id,
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: usageFactor.COMMERCIAL,
        usageType: usageType.RENTED,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        occupancy: "Shop",
        areaSqFt: 1600,
      },
      {
        surveyId: submitted.id,
        floorPosition: FloorPosition.FIRST_FLOOR,
        usageFactor: usageFactor.RESIDENTIAL,
        usageType: usageType.SELF_OCCUPIED,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        occupancy: "Residence",
        areaSqFt: 1600,
      },
      {
        surveyId: approved.id,
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: usageFactor.COMMERCIAL,
        usageType: usageType.RENTED,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        occupancy: "Bakery",
        areaSqFt: 750,
      },
    ],
  })

  await db.photo.createMany({
    data: [
      {
        surveyId: draft.id,
        photoType: PhotoType.FRONT,
        url: "https://seed.local/photos/SEED-PROP-001-front.jpg",
        width: 1920,
        height: 1080,
        sizeKB: 420,
        capturedAt: new Date("2026-06-10T08:00:00.000Z"),
      },
      {
        surveyId: submitted.id,
        photoType: PhotoType.FRONT,
        url: "https://seed.local/photos/SEED-PROP-002-front.jpg",
        width: 1920,
        height: 1080,
        sizeKB: 510,
        capturedAt: new Date("2026-06-01T09:30:00.000Z"),
      },
      {
        surveyId: submitted.id,
        photoType: PhotoType.SIDE,
        url: "https://seed.local/photos/SEED-PROP-002-side.jpg",
        width: 1920,
        height: 1080,
        sizeKB: 480,
        capturedAt: new Date("2026-06-01T09:35:00.000Z"),
      },
      {
        surveyId: approved.id,
        photoType: PhotoType.FRONT,
        url: "https://seed.local/photos/SEED-PROP-003-front.jpg",
        width: 1600,
        height: 1200,
        sizeKB: 390,
        capturedAt: new Date("2026-05-15T08:45:00.000Z"),
      },
      {
        surveyId: approved.id,
        photoType: PhotoType.SIDE,
        url: "https://seed.local/photos/SEED-PROP-003-side.jpg",
        width: 1600,
        height: 1200,
        sizeKB: 360,
        capturedAt: new Date("2026-05-15T08:50:00.000Z"),
      },
    ],
  })

  await db.surveyAudit.createMany({
    data: [
      {
        surveyId: draft.id,
        action: "CREATED",
        newValue: { propertyId: "SEED-PROP-001", status: "DRAFT" },
        changedBy: users.surveyor.id,
        changedAt: new Date("2026-06-10T07:55:00.000Z"),
      },
      {
        surveyId: submitted.id,
        action: "CREATED",
        newValue: { propertyId: "SEED-PROP-002", status: "DRAFT" },
        changedBy: users.surveyor.id,
        changedAt: new Date("2026-05-28T11:00:00.000Z"),
      },
      {
        surveyId: submitted.id,
        action: "STATUS_CHANGED",
        oldValue: { status: "DRAFT" },
        newValue: { status: "SUBMITTED" },
        changedBy: users.surveyor.id,
        changedAt: new Date("2026-06-01T10:00:00.000Z"),
      },
      {
        surveyId: approved.id,
        action: "CREATED",
        newValue: { propertyId: "SEED-PROP-003", status: "DRAFT" },
        changedBy: users.surveyor.id,
        changedAt: new Date("2026-05-10T10:00:00.000Z"),
      },
      {
        surveyId: approved.id,
        action: "STATUS_CHANGED",
        oldValue: { status: "SUBMITTED" },
        newValue: { status: "APPROVED" },
        changedBy: users.qcSupervisor.id,
        changedAt: new Date("2026-05-20T14:30:00.000Z"),
      },
    ],
  })

  console.log(`Seeded ${surveys.length} sample surveys with co-owners, floors, photos, and audits`)
}

async function main() {
  const roles = await seedPermissionsAndRoles(prisma)
  const geo = await seedGeography(prisma)
  const users = await seedUsersAndTenantRoles(prisma, geo, roles)
  await seedSampleSurveys(prisma, geo, users)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
