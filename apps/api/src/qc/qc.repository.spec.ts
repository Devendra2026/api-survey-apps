import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, ConflictException } from "@nestjs/common"
import { OwnershipType } from "@workspace/database"
import { QcRepository } from "./qc.repository.js"

describe("QcRepository.qcCorrectSurvey", () => {
  const surveyId = "survey-1"
  const existingSurvey = {
    id: surveyId,
    deletedAt: null,
    surveyStatus: "SUBMITTED",
    qcStatus: "PENDING",
    ownershipType: OwnershipType.JOINT,
    propertyId: "800726-001-00001-001-R",
    parcelNumber: "00001",
    stateId: "state-1",
    districtId: "district-1",
    ulbId: "ulb-1",
    wardId: "w1",
    ulbCode: "800726",
    wardNumber: "001",
    respondentName: "Test",
    mobileNumber: null,
    alternateMobile: null,
    relationshipWithOwner: null,
    familySize: null,
    houseDoorNo: null,
    colony: null,
    locality: null,
    city: null,
    pinCode: null,
    sectorNo: null,
    unitSubNo: "001",
    propertyIdOld: null,
    constructedYear: null,
    isSlum: false,
    propertyUse: "RESIDENTIAL",
    propertyType: null,
    situation: null,
    roadType: null,
    taxRateZone: null,
    assessmentYear: "AY_2025_2026",
    plotAreaSqFt: null,
    plinthAreaSqFt: null,
    waterConnection: null,
    sourceOfWater: null,
    sanitationType: null,
    solidWasteCollection: null,
    latitude: null,
    longitude: null,
    floors: [
      {
        id: "f1",
        floorPosition: "GROUND_FLOOR",
        usageType: null,
        usageFactor: null,
        constructionType: null,
        areaSqFt: 100,
        position: 0,
      },
    ],
    coOwners: [],
    ward: { id: "w1", wardName: "Ward 1", wardNumber: "001" },
    ulb: { id: "ulb-1", name: "Test ULB", code: "800726" },
  }

  const peerSurvey = {
    id: "survey-peer",
    propertyId: "800726-001-00042-001-R",
    parcelNumber: "00042",
    unitSubNo: "001",
    propertyUse: "RESIDENTIAL",
    ulbId: "ulb-1",
    wardId: "w1",
    stateId: "state-1",
    districtId: "district-1",
    assessmentYear: "AY_2025_2026",
    ulbCode: "800726",
    wardNumber: "001",
  }

  function makeRepo(surveyOverrides: Record<string, unknown> = {}) {
    const survey = { ...existingSurvey, ...surveyOverrides }
    const tx = {
      survey: {
        update: jest.fn().mockResolvedValue({} as never),
        findFirstOrThrow: jest.fn().mockResolvedValue({} as never),
      },
      floor: {
        findFirst: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ id: "f-new" } as never),
        findMany: jest.fn().mockResolvedValue([{ areaSqFt: 120 } as never] as never),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 } as never),
      },
      coOwner: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "co-new" } as never),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 } as never),
      },
      surveyAudit: { create: jest.fn().mockResolvedValue({} as never) },
    }

    const prisma = {
      db: {
        survey: {
          findFirst: jest.fn().mockResolvedValue(survey as never),
        },
        $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
      },
    }

    // First findFirst = existing survey; subsequent findFirst calls = uniqueness checks (none)
    prisma.db.survey.findFirst = jest
      .fn()
      .mockResolvedValueOnce(survey as never)
      .mockResolvedValueOnce(null as never)

    const wardCatalog = { listScopedWards: jest.fn<() => Promise<unknown[]>>(() => Promise.resolve([])) }
    return { repo: new QcRepository(prisma as never, wardCatalog as never), tx, prisma }
  }

  it("rejects JOINT ownership with empty co-owners", async () => {
    const { repo } = makeRepo()
    await expect(repo.qcCorrectSurvey(surveyId, { coOwners: [] }, "user-1")).rejects.toThrow(BadRequestException)
  })

  it("allows save when fatherHusbandName is null and there are no co-owners", async () => {
    const { repo, tx } = makeRepo({ ownershipType: OwnershipType.INDIVIDUAL, coOwners: [] })
    await expect(
      repo.qcCorrectSurvey(
        surveyId,
        {
          fatherHusbandName: null,
          respondentName: "Suneel kumar",
          coOwners: [],
        },
        "user-1"
      )
    ).resolves.toBeDefined()
    expect(tx.surveyAudit.create).toHaveBeenCalled()
  })

  it("allows save when parcelNumber is null without throwing", async () => {
    const { repo, tx } = makeRepo({ ownershipType: OwnershipType.INDIVIDUAL, coOwners: [] })
    await expect(
      repo.qcCorrectSurvey(
        surveyId,
        {
          parcelNumber: null,
          coOwners: [{ name: "Owner" }],
        },
        "user-1"
      )
    ).resolves.toBeDefined()
    expect(tx.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parcelNumber: null }),
      })
    )
  })

  it("rejects corrections when survey is not Pending QC", async () => {
    const { repo } = makeRepo({ surveyStatus: "APPROVED", qcStatus: "APPROVED" })
    await expect(repo.qcCorrectSurvey(surveyId, { respondentName: "X" }, "user-1")).rejects.toThrow(/Pending QC/)
  })

  it("syncs co-owners and floors on correct patch", async () => {
    const { repo, tx } = makeRepo()
    await repo.qcCorrectSurvey(
      surveyId,
      {
        coOwners: [{ name: "Co Owner", mobile: "9876543210" }],
        floors: [{ floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 120 }],
      },
      "user-1"
    )
    expect(tx.coOwner.create).toHaveBeenCalled()
    expect(tx.coOwner.deleteMany).toHaveBeenCalled()
    expect(tx.floor.deleteMany).toHaveBeenCalled()
    expect(tx.surveyAudit.create).toHaveBeenCalled()
  })

  it("persists expanded scalar whitelist fields", async () => {
    const { repo, tx } = makeRepo()
    await repo.qcCorrectSurvey(
      surveyId,
      {
        sectorNo: "18",
        unitSubNo: "001",
        propertyIdOld: "00",
        constructedYear: 2020,
        isSlum: false,
        plotAreaSqFt: 500,
        plinthAreaSqFt: 400,
        latitude: 27.56,
        longitude: 78.66,
        waterConnection: "YES",
        solidWasteCollection: true,
        coOwners: [{ name: "Co Owner", mobile: "9876543210" }],
      },
      "user-1"
    )

    expect(tx.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sectorNo: "18",
          unitSubNo: "001",
          propertyIdOld: "00",
          constructedYear: 2020,
          isSlum: false,
          plotAreaSqFt: 500,
          plinthAreaSqFt: 400,
          latitude: 27.56,
          longitude: 78.66,
          waterConnection: "YES",
          solidWasteCollection: true,
        }),
      })
    )
  })

  it("recomputes built-up area from floor patches", async () => {
    const { repo, tx } = makeRepo()
    tx.floor.findMany.mockResolvedValue([{ areaSqFt: 80 }, { areaSqFt: 40 }] as never)

    await repo.qcCorrectSurvey(
      surveyId,
      {
        floors: [
          { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 80 },
          { floorPosition: "FIRST_FLOOR", usageFactor: "COMMERCIAL", areaSqFt: 40 },
        ],
        coOwners: [{ name: "Co Owner" }],
      },
      "user-1"
    )

    expect(tx.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalBuiltAreaSqFt: 120 }),
      })
    )
  })

  it("rewrites propertyId when parcelNumber changes", async () => {
    const { repo, tx } = makeRepo()
    await repo.qcCorrectSurvey(
      surveyId,
      {
        parcelNumber: "42",
        coOwners: [{ name: "Co Owner" }],
      },
      "user-1"
    )

    expect(tx.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parcelNumber: "00042",
          propertyId: "800726-001-00042-001-R",
        }),
      })
    )
  })

  it("swaps identities when recomputed propertyId is held by another active survey", async () => {
    const { repo, tx, prisma } = makeRepo()
    prisma.db.survey.findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        ...existingSurvey,
      } as never)
      .mockResolvedValueOnce(peerSurvey as never)

    await repo.qcCorrectSurvey(
      surveyId,
      {
        parcelNumber: "42",
        coOwners: [{ name: "Co Owner" }],
      },
      "user-1"
    )

    const updateCalls = tx.survey.update.mock.calls as Array<
      [{ where?: { id?: string }; data?: Record<string, unknown> }]
    >
    expect(updateCalls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: { id: "survey-peer" },
        data: expect.objectContaining({ propertyId: expect.stringMatching(/^TEMP-SWAP-/) }),
      })
    )
    expect(updateCalls.some((c) => c[0]?.data?.propertyId === "800726-001-00042-001-R")).toBe(true)
    expect(
      updateCalls.some((c) => c[0]?.where?.id === "survey-peer" && c[0]?.data?.propertyId === existingSurvey.propertyId)
    ).toBe(true)
    expect(tx.surveyAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "survey.qc_identity_swapped" }),
      })
    )
  })

  it("throws conflict when only assessment year collides with another active survey", async () => {
    const { repo, prisma } = makeRepo()
    prisma.db.survey.findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        ...existingSurvey,
      } as never)
      .mockResolvedValueOnce({ id: "other-ay", propertyId: existingSurvey.propertyId } as never)

    await expect(
      repo.qcCorrectSurvey(
        surveyId,
        {
          assessmentYear: "AY_2026_2027",
          coOwners: [{ name: "Co Owner" }],
        },
        "user-1"
      )
    ).rejects.toThrow(ConflictException)

    // Re-mock for message assertion (mocks were consumed)
    prisma.db.survey.findFirst = jest
      .fn()
      .mockResolvedValueOnce({ ...existingSurvey } as never)
      .mockResolvedValueOnce({ id: "other-ay", propertyId: existingSurvey.propertyId } as never)

    await expect(
      repo.qcCorrectSurvey(
        surveyId,
        {
          assessmentYear: "AY_2026_2027",
          coOwners: [{ name: "Co Owner" }],
        },
        "user-1"
      )
    ).rejects.toThrow(/survey other-ay/)
  })

  it("allows reclaiming a propertyId held only by soft-deleted surveys", async () => {
    const { repo, tx, prisma } = makeRepo()
    prisma.db.survey.findFirst = jest
      .fn()
      .mockResolvedValueOnce({ ...existingSurvey } as never)
      .mockResolvedValueOnce(null as never)

    await repo.qcCorrectSurvey(
      surveyId,
      {
        parcelNumber: "82",
        coOwners: [{ name: "Co Owner" }],
      },
      "user-1"
    )

    expect(tx.survey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parcelNumber: "00082",
          propertyId: "800726-001-00082-001-R",
        }),
      })
    )
    expect(tx.surveyAudit.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "survey.qc_identity_swapped" }),
      })
    )
  })
})

describe("QcRepository.getWards", () => {
  const user = {
    id: "u1",
    clerkUserId: "c1",
    email: "qc@test.com",
    fullName: "QC",
    phone: null,
    isActive: true,
    permissions: ["survey:approve"],
    tenantRoles: [
      {
        id: "tr1",
        roleId: "r1",
        roleName: "QC_SUPERVISOR",
        permissions: ["survey:approve"],
        stateId: null,
        districtId: null,
        ulbId: null,
        wardId: null,
        isActive: true,
      },
    ],
  }

  const catalogWards = [
    { id: "ward-1", wardName: "Ward 1", wardNumber: "001" },
    { id: "ward-2", wardName: "Ward 2", wardNumber: "002" },
  ]

  function makeWardsRepo() {
    const listScopedWards = jest.fn().mockResolvedValue(catalogWards as never)
    const groupBy = jest.fn().mockResolvedValue([] as never)
    const prisma = {
      db: {
        survey: { groupBy },
      },
    }
    const repo = new QcRepository(prisma as never, { listScopedWards } as never)
    return { repo, listScopedWards, groupBy }
  }

  it("returns all scoped wards when wardId is omitted", async () => {
    const { repo, listScopedWards } = makeWardsRepo()
    const result = await repo.getWards(user, { ulbId: "ulb-1" })
    expect(listScopedWards).toHaveBeenCalledWith(user, "ulb-1")
    expect(result).toHaveLength(2)
    expect(result.map((w) => w.wardId)).toEqual(["ward-1", "ward-2"])
  })

  it("returns only the selected ward when wardId is set", async () => {
    const { repo, groupBy } = makeWardsRepo()
    const result = await repo.getWards(user, { ulbId: "ulb-1", wardId: "ward-2" })
    expect(result).toHaveLength(1)
    expect(result[0]?.wardId).toBe("ward-2")
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          wardId: { in: ["ward-2"] },
        }),
      })
    )
  })

  it("returns empty list when ulbId is missing", async () => {
    const { repo, listScopedWards } = makeWardsRepo()
    await expect(repo.getWards(user as never, {})).resolves.toEqual([])
    expect(listScopedWards).not.toHaveBeenCalled()
  })
})
