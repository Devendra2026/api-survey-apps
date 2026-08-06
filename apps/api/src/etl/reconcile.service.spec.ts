import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ConfigService } from "@nestjs/config"
import type { ConvexSurveyBundle } from "@workspace/etl-core"

const getSurveyBundles = jest.fn<(_ids: string[]) => Promise<ConvexSurveyBundle[]>>()
const listSurveyIds =
  jest.fn<
    (_input: {
      cursor: string | null
      numItems: number
    }) => Promise<{ ids: string[]; continueCursor: string | null; isDone: boolean }>
  >()

jest.unstable_mockModule("@workspace/etl-core", () => ({
  assertDistrictId: (districtId: string | null | undefined): string => {
    const id = districtId?.trim() ?? ""
    if (!id) throw new Error("districtId is required")
    return id
  },
  ConvexHttpExtractor: class MockConvexHttpExtractor {
    getSurveyBundles = getSurveyBundles
    listSurveyIds = listSurveyIds
  },
  DEFAULT_ETL_BATCH_SIZE: 100,
}))

const { ReconcileService } = await import("./reconcile.service.js")

describe("ReconcileService", () => {
  const district = { id: "district-1", name: "Baghpat" }
  const ulbs = [{ id: "ulb-1", code: "ULB-01", name: "Test ULB" }]

  const prisma = {
    db: {
      district: { findUnique: jest.fn() },
      ulb: { findMany: jest.fn() },
      survey: { findMany: jest.fn() },
    },
  }

  const config = {
    get: jest.fn((key: string) => {
      if (key === "CONVEX_SITE_URL") return "https://example.convex.site"
      if (key === "ETL_CONVEX_SECRET") return "secret"
      return undefined
    }),
  }

  const service = new ReconcileService(
    prisma as unknown as Parameters<typeof ReconcileService>[0],
    config as ConfigService
  )

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.db.district.findUnique.mockResolvedValue(district)
    prisma.db.ulb.findMany.mockResolvedValue(ulbs)
    listSurveyIds.mockResolvedValue({ ids: [], continueCursor: null, isDone: true })
  })

  it("throws when districtId is missing", async () => {
    await expect(service.reconcileWithConvex("")).rejects.toThrow(/districtId is required/)
  })

  it("reports one status mismatch for a PENDING QC survey whose Convex status differs", async () => {
    prisma.db.survey.findMany.mockResolvedValue([
      {
        id: "nest-1",
        legacySurveyId: "conv-1",
        surveyStatus: "DRAFT",
        wardNumber: "1",
        ulbId: "ulb-1",
        qcStatus: "PENDING",
      },
    ])

    getSurveyBundles.mockResolvedValue([
      {
        _id: "conv-1",
        status: "submitted",
        wardNo: "1",
        municipalityCode: "ULB-01",
      } as unknown as ConvexSurveyBundle,
    ])

    const result = await service.reconcileWithConvex("district-1")

    expect(result.totals).toMatchObject({
      nestSurveys: 1,
      withLegacyId: 1,
      ok: 0,
      statusMismatch: 1,
      wardMismatch: 0,
      onlyNest: 0,
      onlyConvexSampled: 0,
    })
    expect(result.samples.statusMismatch).toHaveLength(1)
    expect(result.samples.statusMismatch[0]).toMatchObject({
      legacySurveyId: "conv-1",
      nestStatus: "DRAFT",
      convexStatus: "SUBMITTED",
    })
  })

  it("reports one ok when status and normalized ward match", async () => {
    prisma.db.survey.findMany.mockResolvedValue([
      {
        id: "nest-2",
        legacySurveyId: "conv-2",
        surveyStatus: "SUBMITTED",
        wardNumber: "2",
        ulbId: "ulb-1",
        qcStatus: "PENDING",
      },
    ])

    getSurveyBundles.mockResolvedValue([
      {
        _id: "conv-2",
        status: "submitted",
        wardNo: "2",
        municipalityCode: "ULB-01",
      } as unknown as ConvexSurveyBundle,
    ])

    const result = await service.reconcileWithConvex("district-1")

    expect(result.totals).toMatchObject({
      nestSurveys: 1,
      withLegacyId: 1,
      ok: 1,
      statusMismatch: 0,
      wardMismatch: 0,
      onlyNest: 0,
      onlyConvexSampled: 0,
    })
    expect(result.samples.statusMismatch).toHaveLength(0)
  })

  it("reports one onlyNest when Convex has no matching bundle", async () => {
    prisma.db.survey.findMany.mockResolvedValue([
      {
        id: "nest-3",
        legacySurveyId: "conv-3",
        surveyStatus: "SUBMITTED",
        wardNumber: "3",
        ulbId: "ulb-1",
        qcStatus: "PENDING",
      },
    ])

    getSurveyBundles.mockResolvedValue([])

    const result = await service.reconcileWithConvex("district-1")

    expect(result.totals).toMatchObject({
      nestSurveys: 1,
      withLegacyId: 1,
      ok: 0,
      statusMismatch: 0,
      wardMismatch: 0,
      onlyNest: 1,
      onlyConvexSampled: 0,
    })
    expect(result.samples.onlyNest).toHaveLength(1)
    expect(result.samples.onlyNest[0]).toMatchObject({ surveyId: "nest-3", legacySurveyId: "conv-3" })
  })

  it("counts Convex surveys in district ULBs that are missing in Nest", async () => {
    prisma.db.survey.findMany.mockResolvedValue([])
    listSurveyIds.mockResolvedValue({ ids: ["conv-4"], continueCursor: null, isDone: true })
    getSurveyBundles.mockResolvedValue([
      {
        _id: "conv-4",
        status: "submitted",
        wardNo: "4",
        municipalityCode: "ULB-01",
      } as unknown as ConvexSurveyBundle,
    ])

    const result = await service.reconcileWithConvex("district-1")

    expect(result.totals).toMatchObject({
      nestSurveys: 0,
      withLegacyId: 0,
      ok: 0,
      statusMismatch: 0,
      wardMismatch: 0,
      onlyNest: 0,
      onlyConvexSampled: 1,
    })
    expect(result.samples.onlyConvex).toHaveLength(1)
    expect(result.samples.onlyConvex[0]).toMatchObject({ legacySurveyId: "conv-4", municipalityCode: "ULB-01" })
  })
})
