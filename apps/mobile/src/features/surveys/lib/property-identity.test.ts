import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { previewPropertyId } from "./property-identity.ts"

describe("property identity", () => {
  it("builds the canonical id from ULB, ward, parcel, unit and property-use code", () => {
    // Letters below are PROPERTY_USE_CODES mappings, not assumptions about the example id.
    assert.equal(
      previewPropertyId({
        ulbCode: "801262",
        wardNo: "001",
        parcelNo: "00747",
        unitNo: "001",
        propertyUse: "COMMERCIAL",
      }),
      "801262-001-00747-001-C"
    )
    assert.equal(
      previewPropertyId({
        ulbCode: "801262",
        wardNo: "12",
        parcelNo: "00004",
        unitNo: "002",
        propertyUse: "RESIDENTIAL",
      }),
      "801262-012-00004-002-R"
    )
    assert.equal(
      previewPropertyId({
        ulbCode: "801262",
        wardNo: "001",
        parcelNo: "00747",
        unitNo: "001",
        propertyUse: "OPEN_LAND",
      }),
      "801262-001-00747-001-P"
    )
  })

  it("returns null for an unmapped property use", () => {
    assert.equal(
      previewPropertyId({
        ulbCode: "801262",
        wardNo: "001",
        parcelNo: "00747",
        unitNo: "001",
        propertyUse: "SHOP",
      }),
      null
    )
  })

  it("pads short ward, parcel and unit and rejects values that are too long", () => {
    // OPEN_LAND maps to P in PROPERTY_USE_CODES. The numbers are not hardcoded ids.
    assert.equal(
      previewPropertyId({
        ulbCode: "801262",
        wardNo: "1",
        parcelNo: "74",
        unitNo: "1",
        propertyUse: "OPEN_LAND",
      }),
      "801262-001-00074-001-P",
    )
    assert.equal(
      previewPropertyId({
        ulbCode: "801262",
        wardNo: "7",
        parcelNo: "747",
        unitNo: "1",
        propertyUse: "OPEN_LAND",
      }),
      "801262-007-00747-001-P",
    )
    assert.equal(
      previewPropertyId({
        ulbCode: "801262",
        wardNo: "001",
        parcelNo: "12345",
        unitNo: "123",
        propertyUse: "OPEN_LAND",
      }),
      "801262-001-12345-123-P",
    )
    assert.equal(
      previewPropertyId({
        ulbCode: "801262",
        wardNo: "001",
        parcelNo: "123456",
        unitNo: "001",
        propertyUse: "OPEN_LAND",
      }),
      null,
    )
    assert.equal(
      previewPropertyId({
        ulbCode: "801262",
        wardNo: "001",
        parcelNo: "00074",
        unitNo: "1234",
        propertyUse: "OPEN_LAND",
      }),
      null,
    )
  })
})
