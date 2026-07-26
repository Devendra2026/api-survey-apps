import { describe, expect, it } from "@jest/globals"
import {
  computeDemandTotals,
  computeFloorAlv,
  formatAssessmentYearLabel,
  resolveUsageRateMult,
  roundMoney,
} from "./tax-calc.js"
import { signPrintToken, verifyPrintToken } from "./print-token.js"

describe("demand-notice tax-calc", () => {
  it("computes floor ALV with annual rate (no ×12)", () => {
    const result = computeFloorAlv(100, 2.76, 1, 80, 10)
    expect(result.grossAlv).toBe(276)
    expect(result.assessableAlv).toBe(220.8)
    expect(result.propertyTax).toBe(22.08)
  })

  it("applies commercial usage multiplier", () => {
    expect(resolveUsageRateMult("COMMERCIAL", "RENTED", null)).toBe(2)
    expect(resolveUsageRateMult("RESIDENTIAL", "SELF_OCCUPIED", null)).toBe(1)
    const doubled = computeFloorAlv(100, 2, 2, 80, 10)
    expect(doubled.grossAlv).toBe(400)
  })

  it("sums demand with optional penalty", () => {
    const noPenalty = computeDemandTotals(1000, 100, 7.5, 2.5, 0, true, true)
    expect(noPenalty.waterTax).toBe(75)
    expect(noPenalty.drainageTax).toBe(25)
    expect(noPenalty.penalty).toBe(0)
    expect(noPenalty.totalAnnualDemand).toBe(200)

    const withPenalty = computeDemandTotals(1000, 100, 7.5, 2.5, 10, true, true)
    expect(withPenalty.penalty).toBe(10)
    expect(withPenalty.totalAnnualDemand).toBe(210)
  })

  it("formats assessment year labels", () => {
    expect(formatAssessmentYearLabel("AY_2025_2026")).toBe("2025-2026")
  })

  it("rounds money to paise", () => {
    expect(roundMoney(1.006)).toBe(1.01)
    expect(roundMoney(1.004)).toBe(1)
  })
})

describe("print-token", () => {
  const secret = "test-secret-key"

  it("signs and verifies tokens", () => {
    const token = signPrintToken({ surveyId: "s1", exp: Date.now() + 60_000 }, secret)
    const claims = verifyPrintToken(token, secret)
    expect(claims.surveyId).toBe("s1")
  })

  it("rejects expired tokens", () => {
    const token = signPrintToken({ wardId: "w1", exp: Date.now() - 1000 }, secret)
    expect(() => verifyPrintToken(token, secret)).toThrow(/expired/i)
  })

  it("rejects tampered tokens", () => {
    const token = signPrintToken({ wardId: "w1", exp: Date.now() + 60_000 }, secret)
    expect(() => verifyPrintToken(token + "x", secret)).toThrow()
  })
})
