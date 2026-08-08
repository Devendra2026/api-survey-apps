import { describe, expect, it } from "@jest/globals"
import { computeDemandTotals, computeExportTaxSummary, computeFloorAlv, roundMoney, taxRateKey } from "./tax-calc.js"

describe("tax-calc export summary", () => {
  it("computes floor ALV and demand totals", () => {
    const alv = computeFloorAlv(100, 10, 1, 80, 10)
    expect(alv.grossAlv).toBe(1000)
    expect(alv.assessableAlv).toBe(800)
    expect(alv.propertyTax).toBe(80)

    const totals = computeDemandTotals(800, 80, 7.5, 2.5, 0, true, true)
    expect(totals.waterTax).toBe(60)
    expect(totals.drainageTax).toBe(20)
    expect(totals.totalAnnualDemand).toBe(160)
  })

  it("computes export tax summary from rate table", () => {
    const rates = {
      assessablePct: 80,
      propertyTaxPct: 10,
      waterTaxPct: 7.5,
      drainageTaxPct: 2.5,
      penaltyPct: 0,
      rateByZoneAndConstruction: new Map([[taxRateKey("ZONE_A", "RCC"), 10]]),
      anyRateByZone: new Map([["ZONE_A", 10]]),
    }
    const summary = computeExportTaxSummary({
      taxRateZone: "ZONE_A",
      propertyUse: "RESIDENTIAL",
      waterConnection: "YES",
      floors: [{ floorPosition: "GROUND_FLOOR", constructionType: "RCC", areaSqFt: 100 }],
      rates,
    })
    expect(summary.propertyTax).toBe(80)
    expect(summary.waterTax).toBe(60)
    expect(summary.drainageTax).toBe(20)
    expect(summary.penalty).toBe(0)
    expect(summary.totalDemand).toBe(160)
    expect(roundMoney(summary.propertyTax + summary.waterTax + summary.drainageTax)).toBe(summary.totalDemand)
  })

  it("throws when zone is missing", () => {
    expect(() =>
      computeExportTaxSummary({
        taxRateZone: null,
        floors: [],
        rates: {
          assessablePct: 80,
          propertyTaxPct: 10,
          waterTaxPct: 7.5,
          drainageTaxPct: 2.5,
          penaltyPct: 0,
          rateByZoneAndConstruction: new Map(),
          anyRateByZone: new Map(),
        },
      })
    ).toThrow(/tax rate zone is missing/)
  })
})
