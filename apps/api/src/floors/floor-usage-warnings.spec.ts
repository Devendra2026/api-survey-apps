import { describe, expect, it } from "@jest/globals"
import { evaluateMixedUseFloorWarnings } from "@workspace/validation"

describe("evaluateMixedUseFloorWarnings", () => {
  it("returns no warnings for clean mixed ground floor when propertyUse is MIX_PROPERTY", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "MIX_PROPERTY",
      plotAreaSqFt: 1000,
      plinthAreaSqFt: 1000,
      totalBuiltAreaSqFt: 1000,
      floors: [
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 600 },
        { floorPosition: "GROUND_FLOOR", usageFactor: "COMMERCIAL", areaSqFt: 400 },
      ],
    })
    expect(warnings).toEqual([])
  })

  it("warns when mixed usages but propertyUse is not MIX_PROPERTY", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "RESIDENTIAL",
      floors: [
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 600 },
        { floorPosition: "GROUND_FLOOR", usageFactor: "COMMERCIAL", areaSqFt: 400 },
      ],
    })
    expect(warnings.some((w) => w.code === "MIXED_USE_PROPERTY_USE_MISMATCH")).toBe(true)
  })

  it("warns when floor area sum exceeds plot", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "MIX_PROPERTY",
      plotAreaSqFt: 500,
      floors: [
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 600 },
        { floorPosition: "FIRST_FLOOR", usageFactor: "COMMERCIAL", areaSqFt: 400 },
      ],
    })
    expect(warnings.some((w) => w.code === "FLOOR_AREA_EXCEEDS_PLOT")).toBe(true)
  })

  it("warns when floor area sum exceeds plinth", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "COMMERCIAL",
      plinthAreaSqFt: 100,
      floors: [{ floorPosition: "GROUND_FLOOR", usageFactor: "COMMERCIAL", areaSqFt: 200 }],
    })
    expect(warnings.some((w) => w.code === "FLOOR_AREA_EXCEEDS_PLINTH")).toBe(true)
  })

  it("warns on built-up mismatch beyond tolerance", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "RESIDENTIAL",
      totalBuiltAreaSqFt: 900,
      floors: [{ floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 1000 }],
    })
    expect(warnings.some((w) => w.code === "BUILT_UP_MISMATCH")).toBe(true)
  })

  it("does not warn built-up within 0.01 tolerance", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "RESIDENTIAL",
      totalBuiltAreaSqFt: 1000.005,
      floors: [{ floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 1000 }],
    })
    expect(warnings.some((w) => w.code === "BUILT_UP_MISMATCH")).toBe(false)
  })

  it("warns on missing area when sibling on same floor has area", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "MIX_PROPERTY",
      floors: [
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 600 },
        { floorPosition: "GROUND_FLOOR", usageFactor: "COMMERCIAL", areaSqFt: null },
      ],
    })
    expect(warnings.some((w) => w.code === "MISSING_FLOOR_AREA" && w.usageFactor === "COMMERCIAL")).toBe(true)
  })

  it("warns when MIXED usage factor sits beside split usages on same floor", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "MIX_PROPERTY",
      floors: [
        { floorPosition: "GROUND_FLOOR", usageFactor: "MIXED", areaSqFt: 100 },
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 200 },
      ],
    })
    expect(warnings.some((w) => w.code === "USAGE_FACTOR_MIXED_AMBIGUOUS")).toBe(true)
  })

  it("returns no warnings for empty floors", () => {
    expect(
      evaluateMixedUseFloorWarnings({
        propertyUse: "RESIDENTIAL",
        plotAreaSqFt: 1000,
        floors: [],
      })
    ).toEqual([])
  })

  it("skips plot exceed when plot is unset", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "RESIDENTIAL",
      floors: [{ floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 5000 }],
    })
    expect(warnings.some((w) => w.code === "FLOOR_AREA_EXCEEDS_PLOT")).toBe(false)
  })

  it("warns per floorPosition when mixed usages on one floor exceed plot", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "MIX_PROPERTY",
      plotAreaSqFt: 1000,
      totalBuiltAreaSqFt: 1100,
      floors: [
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 650 },
        { floorPosition: "GROUND_FLOOR", usageFactor: "COMMERCIAL", areaSqFt: 450 },
      ],
    })
    const perFloor = warnings.find((w) => w.code === "FLOOR_AREA_EXCEEDS_PLOT" && w.floorPosition === "GROUND_FLOOR")
    expect(perFloor).toBeDefined()
    expect(perFloor?.message).toMatch(/Total area on this floor exceeds plot area/)
  })

  it("does not emit per-floor plot warning when floor total is within plot", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "MIX_PROPERTY",
      plotAreaSqFt: 1000,
      totalBuiltAreaSqFt: 1000,
      floors: [
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 650 },
        { floorPosition: "GROUND_FLOOR", usageFactor: "COMMERCIAL", areaSqFt: 350 },
      ],
    })
    expect(warnings.some((w) => w.code === "FLOOR_AREA_EXCEEDS_PLOT" && w.floorPosition)).toBe(false)
  })
})
