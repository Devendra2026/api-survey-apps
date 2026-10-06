import { describe, expect, it } from "@jest/globals"
import { sqFtToSqMeter, sqMeterToSqFt } from "./convex-import-map.js"

describe("area unit conversion", () => {
  it("converts 100 square feet to 9.2903 square meters", () => {
    expect(sqFtToSqMeter(100)).toBe(9.2903)
  })

  it("round-trips that pair back through square feet", () => {
    expect(sqMeterToSqFt(9.2903)).toBe(100)
    const sqFt = sqMeterToSqFt(50)
    const sqMeter = sqFtToSqMeter(sqFt)
    expect(sqFtToSqMeter(sqMeterToSqFt(sqMeter))).toBe(sqMeter)
  })

  it("returns undefined when the input is missing", () => {
    expect(sqFtToSqMeter(undefined)).toBeUndefined()
    expect(sqMeterToSqFt(undefined)).toBeUndefined()
  })
})
