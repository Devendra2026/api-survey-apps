import { describe, expect, it } from "@jest/globals"
import {
  compareWardNumbersAsc,
  normalizeWardNumber,
  sortWardsByNumberAsc,
  wardNumbersMatch,
} from "@workspace/validation"

describe("normalizeWardNumber (shared)", () => {
  it("strips leading zeros for numeric wards", () => {
    expect(normalizeWardNumber("01")).toBe("1")
    expect(normalizeWardNumber("05")).toBe("5")
    expect(normalizeWardNumber("00")).toBe("0")
    expect(normalizeWardNumber("12")).toBe("12")
  })

  it("collapses W## and *-W## codes to the same digit key", () => {
    expect(normalizeWardNumber("W01")).toBe("1")
    expect(normalizeWardNumber("W02")).toBe("2")
    expect(normalizeWardNumber("w12")).toBe("12")
    expect(normalizeWardNumber("AGR-W02")).toBe("2")
    expect(normalizeWardNumber("250726-W10")).toBe("10")
  })

  it("keeps other alphanumeric ward numbers as-is", () => {
    expect(normalizeWardNumber("14A")).toBe("14A")
  })

  it("matches spelling variants that look identical in the UI pills", () => {
    expect(wardNumbersMatch("1", "01")).toBe(true)
    expect(wardNumbersMatch("2", "W02")).toBe(true)
    expect(wardNumbersMatch("02", "AGR-W02")).toBe(true)
    expect(wardNumbersMatch("1", "2")).toBe(false)
  })

  it("sorts wards in numeric ascending order", () => {
    const sorted = sortWardsByNumberAsc([
      { wardNumber: "W10", id: "10" },
      { wardNumber: "2", id: "2" },
      { wardNumber: "W01", id: "1" },
      { wardNumber: "12", id: "12" },
    ])
    expect(sorted.map((w) => w.id)).toEqual(["1", "2", "10", "12"])
    expect(compareWardNumbersAsc("2", "10")).toBeLessThan(0)
  })
})
