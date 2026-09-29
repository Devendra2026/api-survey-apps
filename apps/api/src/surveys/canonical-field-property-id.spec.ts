import { describe, expect, it } from "@jest/globals"
import { canonicalFieldPropertyId } from "./surveys.service.js"

describe("canonicalFieldPropertyId", () => {
  it("maps COMMERCIAL to C via PROPERTY_USE_CODES", () => {
    expect(
      canonicalFieldPropertyId({
        ulbCode: "801262",
        wardNo: "001",
        parcelNo: "00747",
        unitNo: "001",
        propertyUse: "COMMERCIAL",
      })
    ).toBe("801262-001-00747-001-C")
  })

  it("maps OPEN_LAND to P (not O)", () => {
    expect(
      canonicalFieldPropertyId({
        ulbCode: "801262",
        wardNo: "001",
        parcelNo: "00747",
        unitNo: "001",
        propertyUse: "OPEN_LAND",
      })
    ).toBe("801262-001-00747-001-P")
  })

  it("pads ward via formatPropertyId and maps RESIDENTIAL to R", () => {
    expect(
      canonicalFieldPropertyId({
        ulbCode: "801262",
        wardNo: "12",
        parcelNo: "00747",
        unitNo: "001",
        propertyUse: "RESIDENTIAL",
      })
    ).toBe("801262-012-00747-001-R")
  })

  it("pads short parcel and unit and rejects values that are too long", () => {
    expect(
      canonicalFieldPropertyId({
        ulbCode: "801262",
        wardNo: "1",
        parcelNo: "74",
        unitNo: "1",
        propertyUse: "OPEN_LAND",
      })
    ).toBe("801262-001-00074-001-P")
    expect(
      canonicalFieldPropertyId({
        ulbCode: "801262",
        wardNo: "7",
        parcelNo: "747",
        unitNo: "1",
        propertyUse: "OPEN_LAND",
      })
    ).toBe("801262-007-00747-001-P")
    expect(
      canonicalFieldPropertyId({
        ulbCode: "801262",
        wardNo: "001",
        parcelNo: "123456",
        unitNo: "001",
        propertyUse: "OPEN_LAND",
      })
    ).toBeUndefined()
    expect(
      canonicalFieldPropertyId({
        ulbCode: "801262",
        wardNo: "001",
        parcelNo: "00074",
        unitNo: "1234",
        propertyUse: "OPEN_LAND",
      })
    ).toBeUndefined()
  })

  it("returns undefined for an unmapped property use", () => {
    expect(
      canonicalFieldPropertyId({
        ulbCode: "801262",
        wardNo: "001",
        parcelNo: "00747",
        unitNo: "001",
        propertyUse: "SHOP",
      })
    ).toBeUndefined()
  })
})
