import { describe, expect, it } from "@jest/globals"
import { evaluateMixedUseFloorWarnings, sumBuiltUpArea } from "@workspace/validation"

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

  it("allows multi-story stacking at full plot without survey-wide plot exceed", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "RESIDENTIAL",
      plotAreaSqFt: 750,
      totalBuiltAreaSqFt: 5250,
      floors: [
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 750 },
        { floorPosition: "FIRST_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 750 },
        { floorPosition: "SECOND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 750 },
        { floorPosition: "THIRD_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 750 },
        { floorPosition: "FOURTH_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 750 },
        { floorPosition: "FIFTH_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 750 },
        { floorPosition: "SIXTH_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 750 },
      ],
    })
    expect(warnings.some((w) => w.code === "FLOOR_AREA_EXCEEDS_PLOT")).toBe(false)
    expect(warnings.some((w) => w.code === "FLOOR_AREA_UNUSUALLY_HIGH")).toBe(true)
  })

  it("does not warn survey-wide plinth when each floor is within plinth", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "RESIDENTIAL",
      plinthAreaSqFt: 450,
      totalBuiltAreaSqFt: 900,
      floors: [
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 450 },
        { floorPosition: "FIRST_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 450 },
      ],
    })
    expect(warnings.some((w) => w.code === "FLOOR_AREA_EXCEEDS_PLINTH")).toBe(false)
  })

  it("excludes OPEN_LAND from built-up mismatch comparison", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "RESIDENTIAL",
      plotAreaSqFt: 600,
      totalBuiltAreaSqFt: 600,
      floors: [
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 600 },
        { floorPosition: "OPEN_LAND", usageFactor: "OPEN_LAND", areaSqFt: 600 },
      ],
    })
    expect(warnings.some((w) => w.code === "BUILT_UP_MISMATCH")).toBe(false)
  })

  it("warns when open-land property use still has floor rows", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "OPEN_LAND",
      floors: [{ floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 100 }],
    })
    expect(warnings.some((w) => w.code === "OPEN_LAND_HAS_FLOORS")).toBe(true)
  })

  it("warns when floor area on one position exceeds plinth", () => {
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

  it("allows Residential Pakka + Tin Shed segments on the same floor without mix mismatch", () => {
    const warnings = evaluateMixedUseFloorWarnings({
      propertyUse: "RESIDENTIAL",
      plotAreaSqFt: 1000,
      totalBuiltAreaSqFt: 1000,
      floors: [
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 600 },
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 400 },
      ],
    })
    expect(warnings.some((w) => w.code === "MIXED_USE_PROPERTY_USE_MISMATCH")).toBe(false)
    expect(warnings.some((w) => w.code === "FLOOR_AREA_EXCEEDS_PLOT")).toBe(false)
    expect(
      sumBuiltUpArea([
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 600 },
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 400 },
      ])
    ).toBe(1000)
  })
})

describe("sumBuiltUpArea", () => {
  it("excludes OPEN_LAND position and usage from built-up", () => {
    expect(
      sumBuiltUpArea([
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 400 },
        { floorPosition: "OPEN_LAND", usageFactor: "OPEN_LAND", areaSqFt: 200 },
        { floorPosition: "FIRST_FLOOR", usageFactor: "OPEN_LAND", areaSqFt: 100 },
      ])
    ).toBe(400)
  })
})
