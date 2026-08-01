import {
  AssessmentYear,
  ConstructionType,
  FloorPosition,
  GpsSource,
  OwnershipType,
  PhotoType,
  Prisma,
  PrismaClient,
  PropertyType,
  PropertyUse,
  RoadType,
  SanitationType,
  Situation,
  SourceOfWater,
  SurveyStatus,
  TaxRateZone,
  UsageFactor,
  UsageType,
  WaterConnection,
} from "../src/generated/prisma/client.js"

type Geography = {
  state: { id: string }
  district: { id: string }
  ulb: { id: string }
  wards: { ward1: { id: string }; ward2: { id: string } }
}

type RoleMap = Record<string, { id: string; name: string }>

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
      email: "admin@seed.local",
      fullName: "Seed Admin",
      isActive: true,
    },
    update: {
      email: "admin@seed.local",
      fullName: "Seed Admin",
      isActive: true,
    },
  })

  const surveyor = await db.user.upsert({
    where: { clerkUserId: "user_seed_surveyor" },
    create: {
      clerkUserId: "user_seed_surveyor",
      email: "surveyor@seed.local",
      fullName: "Seed Surveyor",
      isActive: true,
    },
    update: {
      email: "surveyor@seed.local",
      fullName: "Seed Surveyor",
      isActive: true,
    },
  })

  const fieldSupervisor = await db.user.upsert({
    where: { clerkUserId: "user_seed_field_supervisor" },
    create: {
      clerkUserId: "user_seed_field_supervisor",
      email: "field.supervisor@seed.local",
      fullName: "Seed Field Supervisor",
      isActive: true,
    },
    update: {
      email: "field.supervisor@seed.local",
      fullName: "Seed Field Supervisor",
      isActive: true,
    },
  })

  const qcSupervisor = await db.user.upsert({
    where: { clerkUserId: "user_seed_qc_supervisor" },
    create: {
      clerkUserId: "user_seed_qc_supervisor",
      email: "qc.supervisor@seed.local",
      fullName: "Seed QC Supervisor",
      isActive: true,
    },
    update: {
      email: "qc.supervisor@seed.local",
      fullName: "Seed QC Supervisor",
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
    })

    console.log(`Seeded bootstrap admin clerkUserId=${seedAdminClerkId} as global ADMIN`)
  }

  console.log("Seeded 4 demo users and tenant role assignments")

  return { admin, surveyor, fieldSupervisor, qcSupervisor }
}

async function seedSampleSurveys(db: PrismaClient, geo: Geography, users: SeedUsers) {
  const surveyorId = users.surveyor.id
  const assignedAt = new Date("2026-06-01T08:00:00.000Z")

  const sharedGeo = {
    stateId: geo.state.id,
    districtId: geo.district.id,
    ulbId: geo.ulb.id,
    wardId: geo.wards.ward1.id,
    createdById: surveyorId,
    assignedToId: surveyorId,
    assignedAt,
    wardNumber: "1",
    ulbCode: "ETM",
    districtName: "Etah",
  }

  /** Active identity upsert — compound @@unique is SQL-partial and not in Prisma client. */
  async function upsertByIdentity(args: {
    ulbId: string
    propertyId: string
    assessmentYear: AssessmentYear
    create: Prisma.SurveyUncheckedCreateInput
    update: Prisma.SurveyUncheckedUpdateInput
  }) {
    const existing = await db.survey.findFirst({
      where: {
        ulbId: args.ulbId,
        propertyId: args.propertyId,
        assessmentYear: args.assessmentYear,
        deletedAt: null,
      },
    })
    if (existing) {
      return db.survey.update({ where: { id: existing.id }, data: args.update })
    }
    return db.survey.create({ data: args.create })
  }

  const draft = await upsertByIdentity({
    ulbId: geo.ulb.id,
    propertyId: "SEED-PROP-001",
    assessmentYear: AssessmentYear.AY_2025_2026,
    create: {
      ...sharedGeo,
      propertyId: "SEED-PROP-001",
      localId: "LOC-001",
      respondentName: "Demo Respondent A",
      relationshipWithOwner: "Self",
      houseDoorNo: "12-3-45",
      locality: "Etah",
      colony: "Civil Lines",
      city: "Etah",
      pinCode: "207001",
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
      latitude: new Prisma.Decimal("27.558300"),
      longitude: new Prisma.Decimal("78.662800"),
      gpsSource: GpsSource.DEVICE,
      surveyStatus: SurveyStatus.DRAFT,
    },
    update: {
      respondentName: "Demo Respondent A",
      surveyStatus: SurveyStatus.DRAFT,
      ownershipType: OwnershipType.INDIVIDUAL,
      propertyUse: PropertyUse.RESIDENTIAL,
      propertyType: PropertyType.RESIDENTIAL_SELF,
      assignedToId: surveyorId,
      latitude: new Prisma.Decimal("27.558300"),
      longitude: new Prisma.Decimal("78.662800"),
    },
  })

  const submitted = await upsertByIdentity({
    ulbId: geo.ulb.id,
    propertyId: "SEED-PROP-002",
    assessmentYear: AssessmentYear.AY_2025_2026,
    create: {
      ...sharedGeo,
      propertyId: "SEED-PROP-002",
      localId: "LOC-002",
      respondentName: "Demo Respondent B",
      relationshipWithOwner: "Owner",
      familySize: 4,
      houseDoorNo: "8-2-10",
      locality: "Etah",
      colony: "Station Road",
      city: "Etah",
      pinCode: "207001",
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
      latitude: new Prisma.Decimal("27.559100"),
      longitude: new Prisma.Decimal("78.663500"),
      gpsSource: GpsSource.DEVICE,
      surveyStatus: SurveyStatus.SUBMITTED,
      submittedAt: new Date("2026-06-01T10:00:00.000Z"),
    },
    update: {
      respondentName: "Demo Respondent B",
      surveyStatus: SurveyStatus.SUBMITTED,
      submittedAt: new Date("2026-06-01T10:00:00.000Z"),
      ownershipType: OwnershipType.JOINT,
      propertyUse: PropertyUse.MIX_PROPERTY,
      propertyType: PropertyType.RESIDENTIAL_AND_COMMERCIAL,
      assignedToId: surveyorId,
      latitude: new Prisma.Decimal("27.559100"),
      longitude: new Prisma.Decimal("78.663500"),
    },
  })

  const approved = await upsertByIdentity({
    ulbId: geo.ulb.id,
    propertyId: "SEED-PROP-003",
    assessmentYear: AssessmentYear.AY_2026_2027,
    create: {
      ...sharedGeo,
      propertyId: "SEED-PROP-003",
      localId: "LOC-003",
      respondentName: "Demo Respondent C",
      relationshipWithOwner: "Authorized Signatory",
      houseDoorNo: "5-1-100",
      locality: "Etah",
      colony: "Market Area",
      city: "Etah",
      pinCode: "207001",
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
      latitude: new Prisma.Decimal("27.557500"),
      longitude: new Prisma.Decimal("78.661200"),
      gpsSource: GpsSource.DEVICE,
      surveyStatus: SurveyStatus.APPROVED,
      submittedAt: new Date("2026-05-15T09:00:00.000Z"),
      approvedAt: new Date("2026-05-20T14:30:00.000Z"),
      qcRemarks: "Verified on site; measurements match",
    },
    update: {
      respondentName: "Demo Respondent C",
      surveyStatus: SurveyStatus.APPROVED,
      submittedAt: new Date("2026-05-15T09:00:00.000Z"),
      approvedAt: new Date("2026-05-20T14:30:00.000Z"),
      qcRemarks: "Verified on site; measurements match",
      ownershipType: OwnershipType.LIMITED_COMPANY_FIRM,
      propertyUse: PropertyUse.COMMERCIAL,
      propertyType: PropertyType.SHOP_BAKERY,
      assignedToId: surveyorId,
      latitude: new Prisma.Decimal("27.557500"),
      longitude: new Prisma.Decimal("78.661200"),
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
        name: "Demo Co-owner A1",
        fatherOrHusbandName: "Demo Guardian A1",
      },
      {
        surveyId: submitted.id,
        name: "Demo Co-owner B1",
        fatherOrHusbandName: "Demo Guardian B1",
      },
      {
        surveyId: submitted.id,
        name: "Demo Co-owner B2",
        fatherOrHusbandName: "Demo Guardian B2",
      },
      {
        surveyId: approved.id,
        name: "Demo Co-owner C1",
        fatherOrHusbandName: "Demo Guardian C1",
      },
    ],
  })

  await db.floor.createMany({
    data: [
      {
        surveyId: draft.id,
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.RESIDENTIAL,
        usageType: UsageType.SELF_OCCUPIED,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        occupancy: "Occupied",
        areaSqFt: 900,
      },
      {
        surveyId: submitted.id,
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.COMMERCIAL,
        usageType: UsageType.RENTED,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        occupancy: "Shop",
        areaSqFt: 1600,
      },
      {
        surveyId: submitted.id,
        floorPosition: FloorPosition.FIRST_FLOOR,
        usageFactor: UsageFactor.RESIDENTIAL,
        usageType: UsageType.SELF_OCCUPIED,
        constructionType: ConstructionType.PAKKA_BUILDING_WITH_RCC_ROOF,
        occupancy: "Residence",
        areaSqFt: 1600,
      },
      {
        surveyId: approved.id,
        floorPosition: FloorPosition.GROUND_FLOOR,
        usageFactor: UsageFactor.COMMERCIAL,
        usageType: UsageType.RENTED,
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

export async function seedDemo(db: PrismaClient, geo: Geography, roles: RoleMap) {
  const users = await seedUsersAndTenantRoles(db, geo, roles)
  await seedSampleSurveys(db, geo, users)
}
