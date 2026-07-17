import { describe, expect, it, jest } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
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
    ulbId: "ulb-1",
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

    return { repo: new QcRepository(prisma as never), tx, prisma }
  }

  it("rejects JOINT ownership with empty co-owners", async () => {
    const { repo } = makeRepo()
    await expect(repo.qcCorrectSurvey(surveyId, { coOwners: [] }, "user-1")).rejects.toThrow(BadRequestException)
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
        floors: [{ floorPosition: "GROUND_FLOOR", areaSqFt: 120 }],
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
          { floorPosition: "GROUND_FLOOR", areaSqFt: 80 },
          { floorPosition: "FIRST_FLOOR", areaSqFt: 40 },
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

  it("throws conflict when recomputed propertyId already exists", async () => {
    const { repo, prisma } = makeRepo()
    prisma.db.survey.findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        ...existingSurvey,
      } as never)
      .mockResolvedValueOnce({ id: "other-survey" } as never)

    await expect(
      repo.qcCorrectSurvey(
        surveyId,
        {
          parcelNumber: "99",
          coOwners: [{ name: "Co Owner" }],
        },
        "user-1"
      )
    ).rejects.toThrow(/already exists/)
  })
})
