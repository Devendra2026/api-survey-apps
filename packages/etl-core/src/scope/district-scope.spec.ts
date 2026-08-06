import { describe, expect, it } from "@jest/globals"
import { assertDistrictId, isSurveyInDistrictScope } from "./district-scope.js"

describe("district-scope", () => {
  it("assertDistrictId rejects empty", () => {
    expect(() => assertDistrictId(undefined)).toThrow(/districtId is required/)
    expect(() => assertDistrictId("")).toThrow(/districtId is required/)
  })

  it("assertDistrictId trims and returns id", () => {
    expect(assertDistrictId("  dist-1  ")).toBe("dist-1")
  })

  it("isSurveyInDistrictScope matches exactly", () => {
    expect(isSurveyInDistrictScope("d1", "d1")).toBe(true)
    expect(isSurveyInDistrictScope("d2", "d1")).toBe(false)
    expect(isSurveyInDistrictScope(null, "d1")).toBe(false)
  })
})
