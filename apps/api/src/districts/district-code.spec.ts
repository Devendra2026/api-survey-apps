import {
  allocateUniqueDistrictCode,
  deriveDistrictCodeFromName,
  isValidDistrictCode,
  normalizeDistrictCode,
} from "@workspace/validation"

describe("district-code helpers", () => {
  it("normalizes and validates 3-letter codes", () => {
    expect(normalizeDistrictCode(" bag ")).toBe("BAG")
    expect(isValidDistrictCode("BAG")).toBe(true)
    expect(isValidDistrictCode("bag")).toBe(false)
    expect(isValidDistrictCode("BA")).toBe(false)
    expect(isValidDistrictCode("BAG1")).toBe(false)
  })

  it("derives placeholder codes from district names", () => {
    expect(deriveDistrictCodeFromName("Baghpat")).toBe("BAG")
    expect(deriveDistrictCodeFromName("Etah")).toBe("ETA")
    expect(deriveDistrictCodeFromName("A")).toBe("AXX")
    expect(deriveDistrictCodeFromName("12")).toBe("XXX")
  })

  it("allocates unique codes within a state set", () => {
    const used = new Set<string>(["BAG"])
    expect(allocateUniqueDistrictCode("Baghpat", used)).not.toBe("BAG")
    expect(used.size).toBe(2)
    expect(allocateUniqueDistrictCode("ETA", used)).toBe("ETA")
    expect(used.has("ETA")).toBe(true)
  })
})
