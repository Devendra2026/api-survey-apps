import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { SurveysService } from "./surveys.service.js"

describe("SurveysService.ensureFormulaPropertyId", () => {
  let update: jest.Mock
  let service: SurveysService

  const base = {
    id: "survey-1",
    ulbCode: "801262",
    wardNumber: "18",
    parcelNumber: "550",
    unitSubNo: "1",
    propertyUse: "OPEN_LAND",
  }

  beforeEach(() => {
    update = jest.fn()
    const prisma = { db: { survey: { update } } }
    service = new SurveysService({} as never, prisma as never, {} as never, {} as never, {} as never)
  })

  it("upgrades LS_* to formula when components are present", async () => {
    update.mockResolvedValue({} as never)
    const result = await service.ensureFormulaPropertyId({
      ...base,
      propertyId: "LS_MTPP2MFX_ZJ02F4",
    })
    expect(result.propertyId).toBe("801262-018-00550-001-P")
    expect(update).toHaveBeenCalledWith({
      where: { id: "survey-1" },
      data: { propertyId: "801262-018-00550-001-P" },
    })
  })

  it("upgrades TEMP-* to formula when components are present", async () => {
    update.mockResolvedValue({} as never)
    const result = await service.ensureFormulaPropertyId({
      ...base,
      propertyId: "TEMP-SWAP-abc",
      propertyUse: "RESIDENTIAL",
    })
    expect(result.propertyId).toBe("801262-018-00550-001-R")
    expect(update).toHaveBeenCalled()
  })

  it("does not rewrite an already-valid formula propertyId", async () => {
    const result = await service.ensureFormulaPropertyId({
      ...base,
      propertyId: "801262-018-00550-001-P",
    })
    expect(result.propertyId).toBe("801262-018-00550-001-P")
    expect(update).not.toHaveBeenCalled()
  })

  it("does not write when required components are missing", async () => {
    const result = await service.ensureFormulaPropertyId({
      ...base,
      parcelNumber: null,
      propertyId: "LS_MTPP2MFX_ZJ02F4",
    })
    expect(result.propertyId).toBe("LS_MTPP2MFX_ZJ02F4")
    expect(update).not.toHaveBeenCalled()
  })

  it("falls back to related Ulb.code and Ward.wardNumber", async () => {
    update.mockResolvedValue({} as never)
    const result = await service.ensureFormulaPropertyId({
      id: "survey-1",
      propertyId: "LS_ABC",
      ulbCode: null,
      wardNumber: null,
      parcelNumber: "550",
      unitSubNo: "1",
      propertyUse: "RESIDENTIAL",
      ulb: { code: "801262" },
      ward: { wardNumber: "18" },
    })
    expect(result.propertyId).toBe("801262-018-00550-001-R")
  })

  it("does not substitute a Zero Ward number into Property ID", async () => {
    const result = await service.ensureFormulaPropertyId({
      id: "survey-1",
      propertyId: "LS_ABC",
      ulbCode: "801262",
      wardNumber: "12",
      parcelNumber: "10",
      unitSubNo: "1",
      propertyUse: "RESIDENTIAL",
      ward: { wardNumber: "12", kind: "ZERO" },
    })
    expect(result.propertyId).toBe("LS_ABC")
    expect(update).not.toHaveBeenCalled()
  })

  it("uses the original ward number when the current ward is Zero Ward", async () => {
    update.mockResolvedValue({} as never)
    const result = await service.ensureFormulaPropertyId({
      id: "survey-1",
      propertyId: "LS_ABC",
      ulbCode: "801262",
      wardNumber: "2",
      parcelNumber: "10",
      unitSubNo: "1",
      propertyUse: "RESIDENTIAL",
      ward: { wardNumber: "0", kind: "ZERO" },
      originalWard: { wardNumber: "2" },
    })
    expect(result.propertyId).toBe("801262-002-00010-001-R")
  })

  it("keeps stored ID on unique conflict", async () => {
    update.mockRejectedValue(Object.assign(new Error("Unique"), { code: "P2002" }) as never)
    const result = await service.ensureFormulaPropertyId({
      ...base,
      propertyId: "LS_MTPP2MFX_ZJ02F4",
    })
    expect(result.propertyId).toBe("LS_MTPP2MFX_ZJ02F4")
  })
})
