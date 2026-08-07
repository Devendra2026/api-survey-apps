import { describe, expect, it } from "@jest/globals"
import {
  computeFloorsAbbreviation,
  formatExportMobile,
  formatExportParcel,
  formatExportText,
  formatExportUnitNumber,
  resolveExportSurveyId,
} from "./export-format.js"

describe("export-format", () => {
  describe("computeFloorsAbbreviation", () => {
    it("returns G for ground floor only", () => {
      expect(computeFloorsAbbreviation([{ floorPosition: "GROUND_FLOOR", areaSqFt: 412 }])).toBe("G")
    })

    it("returns GF1 for ground + first", () => {
      expect(
        computeFloorsAbbreviation([
          { floorPosition: "GROUND_FLOOR", areaSqFt: 792 },
          { floorPosition: "FIRST_FLOOR", areaSqFt: 792 },
        ])
      ).toBe("GF1")
    })

    it("returns P when no built-up area", () => {
      expect(computeFloorsAbbreviation([])).toBe("P")
      expect(computeFloorsAbbreviation([{ floorPosition: "OPEN_LAND", areaSqFt: 100 }])).toBe("P")
      expect(computeFloorsAbbreviation([{ floorPosition: "GROUND_FLOOR", areaSqFt: 0 }])).toBe("P")
    })

    it("returns GF4 for ground + fourth", () => {
      expect(
        computeFloorsAbbreviation([
          { floorPosition: "GROUND_FLOOR", areaSqFt: 100 },
          { floorPosition: "FOURTH_FLOOR", areaSqFt: 50 },
        ])
      ).toBe("GF4")
    })

    it("returns BGF1F2 when basement through second are present", () => {
      expect(
        computeFloorsAbbreviation([
          { floorPosition: "BASEMENT", areaSqFt: 10 },
          { floorPosition: "GROUND_FLOOR", areaSqFt: 10 },
          { floorPosition: "FIRST_FLOOR", areaSqFt: 10 },
          { floorPosition: "SECOND_FLOOR", areaSqFt: 10 },
        ])
      ).toBe("BGF1F2")
    })

    it("maps FIFTH_FLOOR_PLUS to F5", () => {
      expect(computeFloorsAbbreviation([{ floorPosition: "FIFTH_FLOOR_PLUS", areaSqFt: 500 }])).toBe("F5")
    })
  })

  describe("formatExportMobile", () => {
    it("keeps valid 10-digit mobiles", () => {
      expect(formatExportMobile("9876543210")).toBe("9876543210")
    })

    it("falls back for blank, short, or all-zero values", () => {
      expect(formatExportMobile(null)).toBe("0000000000")
      expect(formatExportMobile("")).toBe("0000000000")
      expect(formatExportMobile("0")).toBe("0000000000")
      expect(formatExportMobile("0000000000")).toBe("0000000000")
      expect(formatExportMobile("12345")).toBe("0000000000")
    })
  })

  describe("formatExportParcel / unit / text", () => {
    it("zero-pads parcel numbers to 5 digits", () => {
      expect(formatExportParcel("1")).toBe("00001")
      expect(formatExportParcel("42")).toBe("00042")
      expect(formatExportParcel("595")).toBe("00595")
    })

    it("pads unit numbers or returns N/A", () => {
      expect(formatExportUnitNumber("1")).toBe("001")
      expect(formatExportUnitNumber(null)).toBe("N/A")
      expect(formatExportUnitNumber("")).toBe("N/A")
    })

    it("uses N/A for blank text", () => {
      expect(formatExportText("Kailash")).toBe("Kailash")
      expect(formatExportText("")).toBe("N/A")
      expect(formatExportText(null)).toBe("N/A")
    })
  })

  describe("resolveExportSurveyId", () => {
    it("prefers stored propertyId", () => {
      expect(
        resolveExportSurveyId({
          propertyId: "801262-001-00595-001-R",
          ulbCode: "801262",
          wardNo: "1",
          parcelNo: "1",
          unitNo: "1",
          propertyUse: "RESIDENTIAL",
        })
      ).toBe("801262-001-00595-001-R")
    })

    it("derives Property ID when propertyId is missing", () => {
      expect(
        resolveExportSurveyId({
          propertyId: "",
          ulbCode: "801262",
          wardNo: "1",
          parcelNo: "595",
          unitNo: "1",
          propertyUse: "RESIDENTIAL",
        })
      ).toBe("801262-001-00595-001-R")
    })

    it("returns null when derivation is impossible", () => {
      expect(
        resolveExportSurveyId({
          propertyId: null,
          ulbCode: "801262",
          wardNo: "1",
          parcelNo: "595",
          unitNo: "",
          propertyUse: "RESIDENTIAL",
        })
      ).toBeNull()
    })
  })
})
