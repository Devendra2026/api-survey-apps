import { describe, expect, it } from "@jest/globals"
import {
  allocateUniqueDistrictCode,
  deriveDistrictCodeFromName,
  isValidDistrictCode,
  normalizeDistrictCode,
} from "@workspace/validation"

describe("geo-catalog district code rules", () => {
  it("accepts optional District Code when valid", () => {
    const code = normalizeDistrictCode("bag")
    expect(isValidDistrictCode(code)).toBe(true)
    expect(code).toBe("BAG")
  })

  it("derives a placeholder when District Code is omitted", () => {
    const used = new Set<string>()
    expect(allocateUniqueDistrictCode("Baghpat", used)).toBe("BAG")
    expect(deriveDistrictCodeFromName("Example District")).toBe("EXA")
  })

  it("rejects invalid format the same way import would", () => {
    expect(isValidDistrictCode(normalizeDistrictCode("12"))).toBe(false)
    expect(isValidDistrictCode(normalizeDistrictCode("ABCD"))).toBe(false)
  })
})
