import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { TaxConfigsService } from "./tax-configs.service.js"

describe("TaxConfigsService bulkApply / firstWithRates", () => {
  const ulbFindUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const wardFindMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const taxConfigFindUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const taxConfigFindUniqueOrThrow = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const taxConfigCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const taxConfigUpdate = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const taxRateCellUpsert = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const referenceEntryFindMany = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const referenceEntryFindUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const wardFindUnique = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  const auditLog = jest.fn<(...args: unknown[]) => Promise<unknown>>()

  const prisma = {
    db: {
      ulb: { findUnique: ulbFindUnique },
      ward: { findMany: wardFindMany, findUnique: wardFindUnique },
      taxConfig: {
        findUnique: taxConfigFindUnique,
        findUniqueOrThrow: taxConfigFindUniqueOrThrow,
        create: taxConfigCreate,
        update: taxConfigUpdate,
      },
      taxRateCell: { upsert: taxRateCellUpsert },
      referenceEntry: { findMany: referenceEntryFindMany, findUnique: referenceEntryFindUnique },
    },
  }

  const service = new TaxConfigsService(prisma as never, { log: auditLog } as never)

  const cells = [
    { roadWidthEntryId: "z1", constructionEntryId: "c1", annualRatePerSqFt: 10 },
    { roadWidthEntryId: "z1", constructionEntryId: "c2", annualRatePerSqFt: 12 },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ulbFindUnique.mockResolvedValue({ id: "ulb1" })
    wardFindMany.mockResolvedValue([{ id: "w1" }, { id: "w2" }, { id: "w3" }])
    taxRateCellUpsert.mockResolvedValue({})
    taxConfigUpdate.mockResolvedValue({})
    auditLog.mockResolvedValue(undefined)
    referenceEntryFindMany.mockResolvedValue([])
  })

  it("copy mode applies cells to all wards except source", async () => {
    taxConfigFindUnique
      .mockResolvedValueOnce({
        id: "cfg-w2",
        wardId: "w2",
        assessmentYearId: "ay1",
        cells: [],
        status: "DRAFT",
      })
      .mockResolvedValueOnce({
        id: "cfg-w3",
        wardId: "w3",
        assessmentYearId: "ay1",
        cells: [],
        status: "DRAFT",
      })
      // upsertCells looks up existing by id
      .mockResolvedValueOnce({ id: "cfg-w2", status: "DRAFT" })
      .mockResolvedValueOnce({ id: "cfg-w3", status: "DRAFT" })

    taxConfigFindUniqueOrThrow
      .mockResolvedValueOnce({ id: "cfg-w2", cells })
      .mockResolvedValueOnce({ id: "cfg-w3", cells })

    const result = await service.bulkApply(
      {
        ulbId: "ulb1",
        assessmentYearId: "ay1",
        mode: "copy",
        sourceWardId: "w1",
        cells,
      },
      "actor1"
    )

    expect(result).toEqual({ updated: 2 })
    expect(taxConfigUpdate).toHaveBeenCalledTimes(2)
    expect(taxRateCellUpsert).toHaveBeenCalledTimes(4) // 2 cells × 2 wards
  })

  it("copy mode rejects missing cells", async () => {
    await expect(
      service.bulkApply({
        ulbId: "ulb1",
        assessmentYearId: "ay1",
        mode: "copy",
        sourceWardId: "w1",
        cells: [],
      })
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it("zero mode resets every ward matrix", async () => {
    const matrix = [
      { roadWidthEntryId: "z1", constructionEntryId: "c1", annualRatePerSqFt: 5 },
      { roadWidthEntryId: "z1", constructionEntryId: "c2", annualRatePerSqFt: 8 },
    ]

    // getOrCreate for each of 3 wards (existing)
    taxConfigFindUnique
      .mockResolvedValueOnce({ id: "cfg-w1", wardId: "w1", cells: matrix, status: "DRAFT" })
      .mockResolvedValueOnce({ id: "cfg-w1", status: "DRAFT" }) // upsertCells
      .mockResolvedValueOnce({ id: "cfg-w2", wardId: "w2", cells: matrix, status: "DRAFT" })
      .mockResolvedValueOnce({ id: "cfg-w2", status: "DRAFT" })
      .mockResolvedValueOnce({ id: "cfg-w3", wardId: "w3", cells: matrix, status: "DRAFT" })
      .mockResolvedValueOnce({ id: "cfg-w3", status: "DRAFT" })

    taxConfigFindUniqueOrThrow
      .mockResolvedValueOnce({ id: "cfg-w1", cells: matrix })
      .mockResolvedValueOnce({ id: "cfg-w2", cells: matrix })
      .mockResolvedValueOnce({ id: "cfg-w3", cells: matrix })

    const result = await service.bulkApply({
      ulbId: "ulb1",
      assessmentYearId: "ay1",
      mode: "zero",
    })

    expect(result).toEqual({ updated: 3 })
    expect(taxRateCellUpsert).toHaveBeenCalledTimes(6)
    expect(
      taxRateCellUpsert.mock.calls.every((call) => {
        const args = call[0] as { update?: { annualRatePerSqFt?: number }; create?: { annualRatePerSqFt?: number } }
        return args.update?.annualRatePerSqFt === 0 || args.create?.annualRatePerSqFt === 0
      })
    ).toBe(true)
  })

  it("firstWithRates returns first config with positive rates", async () => {
    taxConfigFindUnique
      .mockResolvedValueOnce({
        id: "cfg-w1",
        cells: [{ annualRatePerSqFt: 0 }],
      })
      .mockResolvedValueOnce({
        id: "cfg-w2",
        cells: [{ annualRatePerSqFt: 9 }],
      })

    const result = await service.firstWithRates("ulb1", "ay1", "w3")
    expect(result).toEqual(expect.objectContaining({ id: "cfg-w2" }))
  })

  it("firstWithRates returns null when none have rates", async () => {
    taxConfigFindUnique.mockResolvedValue(null)
    await expect(service.firstWithRates("ulb1", "ay1")).resolves.toBeNull()
  })

  it("throws when ULB missing", async () => {
    ulbFindUnique.mockResolvedValue(null)
    await expect(service.bulkApply({ ulbId: "missing", assessmentYearId: "ay1", mode: "zero" })).rejects.toBeInstanceOf(
      NotFoundException
    )
  })
})
