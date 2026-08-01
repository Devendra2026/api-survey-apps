import { describe, expect, it } from "@jest/globals"
import { normalizeAllotmentWardId, validateFieldAllotments, type FieldAllotmentGeo } from "./field-allotments.util.js"

const base = (overrides: Partial<FieldAllotmentGeo> = {}): FieldAllotmentGeo => ({
  stateId: "s1",
  districtId: "d1",
  ulbId: "u1",
  wardId: "w1",
  ...overrides,
})

describe("field-allotments.util", () => {
  it("normalizes empty ward to null", () => {
    expect(normalizeAllotmentWardId("")).toBeNull()
    expect(normalizeAllotmentWardId(undefined)).toBeNull()
    expect(normalizeAllotmentWardId("w1")).toBe("w1")
  })

  it("allows QC single ward", () => {
    expect(() => validateFieldAllotments("QC_SUPERVISOR", [base()])).not.toThrow()
  })

  it("allows QC all wards", () => {
    expect(() => validateFieldAllotments("QC_SUPERVISOR", [base({ wardId: null })])).not.toThrow()
  })

  it("rejects QC multi-ULB", () => {
    expect(() => validateFieldAllotments("QC_SUPERVISOR", [base(), base({ ulbId: "u2", wardId: "w2" })])).toThrow(
      /exactly one Location/
    )
  })

  it("rejects QC with multiple specific wards", () => {
    expect(() => validateFieldAllotments("QC_SUPERVISOR", [base(), base({ wardId: "w2" })])).toThrow(
      /Single Ward|All Wards/
    )
  })

  it("allows Surveyor multi-ULB with mixed ward modes", () => {
    expect(() =>
      validateFieldAllotments("SURVEYOR", [
        base({ ulbId: "etah", wardId: "w1" }),
        base({ ulbId: "etah", wardId: "w2" }),
        base({ ulbId: "baghpat", wardId: null }),
      ])
    ).not.toThrow()
  })

  it("rejects mixing All Wards and specific wards on same ULB", () => {
    expect(() => validateFieldAllotments("SURVEYOR", [base({ wardId: "w1" }), base({ wardId: null })])).toThrow(
      /Cannot mix/
    )
  })

  it("rejects duplicate ward ids", () => {
    expect(() => validateFieldAllotments("SURVEYOR", [base(), base({ ulbId: "u2" })])).toThrow(/Duplicate ward/)
  })
})
