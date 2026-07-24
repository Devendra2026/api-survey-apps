import { describe, expect, it } from "@jest/globals"
import {
  buildWardCandidates,
  canonicalWardNumber,
  checkPropertyIdGeoConsistency,
  collectWorkbookGeoPairs,
  disambiguateImportPropertyId,
  formatDuplicateWorkbookError,
  formatMissingUlbMasterAbort,
  geoErrorMessage,
  importChildJoinKey,
  normalizeImportString,
  resolveImportGeo,
  resolveImportPropertyId,
  type GeoLookupDb,
  type GeoResolveResult,
} from "@workspace/validation"

describe("import-geo helpers", () => {
  it("strips invisible unicode and NBSP from import strings", () => {
    expect(normalizeImportString("\uFEFF800726\u00A0")).toBe("800726")
    expect(normalizeImportString("05\t\r\n")).toBe("05")
  })

  it("builds ward candidates for 05 / 5 / 005", () => {
    expect(buildWardCandidates("05")).toEqual(expect.arrayContaining(["05", "005", "5"]))
    expect(canonicalWardNumber("005")).toBe("5")
  })

  it("formats duplicate workbook errors with import-as-extras guidance", () => {
    expect(formatDuplicateWorkbookError("propertyId", "800726-005-00041-001-R", [53, 371])).toContain(
      "800726-005-00041-001-R"
    )
    expect(formatDuplicateWorkbookError("propertyId", "800726-005-00041-001-R", [53, 371])).toContain("rows 53, 371")
    expect(formatDuplicateWorkbookError("propertyId", "800726-005-00041-001-R", [53, 371])).toContain("-D2")
    expect(formatDuplicateWorkbookError("localId", "L-1", [2, 4])).toContain("All rows are still imported")
  })

  it("disambiguates duplicate Property ID occurrences for unique constraint", () => {
    expect(disambiguateImportPropertyId("800726-005-00041-001-R", 1)).toBe("800726-005-00041-001-R")
    expect(disambiguateImportPropertyId("800726-005-00041-001-R", 2)).toBe("800726-005-00041-001-R-D2")
    expect(disambiguateImportPropertyId("800726-005-00041-001-R", 3)).toBe("800726-005-00041-001-R-D3")
  })

  it("resolves import Property ID: sheet, formula, or missing (no TEMP)", () => {
    expect(
      resolveImportPropertyId({
        sheetPropertyId: "801262-001-03389-001-R",
      })
    ).toEqual({ propertyId: "801262-001-03389-001-R", source: "sheet" })

    expect(
      resolveImportPropertyId({
        sheetPropertyId: "",
        ulbCode: "801262",
        wardNo: "1",
        parcelNo: "3389",
        unitNo: "1",
        propertyUse: "RESIDENTIAL",
      })
    ).toEqual({ propertyId: "801262-001-03389-001-R", source: "derived" })

    expect(
      resolveImportPropertyId({
        sheetPropertyId: "",
        ulbCode: "801262",
      })
    ).toEqual({ propertyId: null, source: "missing" })
  })

  it("builds child join key from Property ID, Local ID, or Survey ID", () => {
    expect(importChildJoinKey({ "Property ID": "801262-001-03389-001-R" })).toBe("801262-001-03389-001-R")
    expect(importChildJoinKey({ "Property ID": "", "Local ID": "L-9" })).toBe("L-9")
    expect(importChildJoinKey({ "Property ID": "", "Local ID": "", "Survey ID": "cuid123" })).toBe("CUID123")
  })

  it("flags Property ID vs Excel ULB/Ward mismatches", () => {
    expect(
      checkPropertyIdGeoConsistency({
        propertyId: "800726-005-00041-001-R",
        excelUlbCode: "800726",
        excelWardNumber: "05",
      })
    ).toBeUndefined()

    expect(
      checkPropertyIdGeoConsistency({
        propertyId: "800726-005-00041-001-R",
        excelUlbCode: "801111",
        excelWardNumber: "05",
      })
    ).toMatch(/does not match Excel ULB/)

    expect(
      checkPropertyIdGeoConsistency({
        propertyId: "800726-005-00041-001-R",
        excelUlbCode: "800726",
        excelWardNumber: "12",
      })
    ).toMatch(/does not match Excel Ward/)
  })

  it("formats ULB master-missing abort message", () => {
    expect(formatMissingUlbMasterAbort(["800726"])).toContain("Import ULB master before importing surveys")
    expect(formatMissingUlbMasterAbort(["800726"])).toContain("800726")
    expect(geoErrorMessage("ULB_NOT_FOUND", "800726", ["05", "5"])).toContain("ULB master data is missing")
  })

  it("collects distinct workbook geo pairs and skips duplicate property ids", () => {
    const pairs = collectWorkbookGeoPairs(
      [
        { "Property ID": "800726-005-00041-001-R", "ULB Code": "800726", "Ward Number": "05" },
        { "Property ID": "800726-005-00042-001-R", "ULB Code": "800726", "Ward Number": "05" },
        { "Property ID": "DUP-1", "ULB Code": "999999", "Ward Number": "1" },
      ],
      { skipPropertyIds: new Set(["DUP-1"]) }
    )
    expect(pairs).toHaveLength(1)
    expect(pairs[0]?.ulbCode).toBe("800726")
    expect(pairs[0]?.sampleRows).toEqual([2, 3])
  })
})

describe("resolveImportGeo", () => {
  function mockDb(options: {
    ulb?: { id: string; code: string; districtId: string; stateId: string } | null
    wardUnderUlb?: { id: string; wardNumber: string; ulbId: string } | null
    wardElsewhere?: { id: string; wardNumber: string; ulbId: string; ulbCode: string } | null
  }): GeoLookupDb {
    return {
      ulb: {
        findFirst: ({ where }) => {
          if (!options.ulb) return Promise.resolve(null)
          if (where.code !== options.ulb.code && where.code !== "800726") return Promise.resolve(null)
          return Promise.resolve({
            id: options.ulb.id,
            code: options.ulb.code,
            districtId: options.ulb.districtId,
            district: { stateId: options.ulb.stateId },
          })
        },
      },
      ward: {
        findFirst: (args) => {
          const where = args.where
          if (where.ulbId && options.wardUnderUlb) {
            return Promise.resolve(options.wardUnderUlb)
          }
          if (where.ulbId && !options.wardUnderUlb) return Promise.resolve(null)
          if (!where.ulbId && options.wardElsewhere) {
            return Promise.resolve({
              id: options.wardElsewhere.id,
              wardNumber: options.wardElsewhere.wardNumber,
              ulbId: options.wardElsewhere.ulbId,
              ulb: { code: options.wardElsewhere.ulbCode },
            })
          }
          return Promise.resolve(null)
        },
      },
    }
  }

  it("returns ULB_NOT_FOUND when master ULB is missing", async () => {
    const cache = new Map<string, GeoResolveResult>()
    const result = await resolveImportGeo(mockDb({ ulb: null }), "800726", "05", cache)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("ULB_NOT_FOUND")
      expect(result.message).toContain("ULB master data is missing")
      expect(result.message).toContain("800726")
    }
  })

  it("returns WARD_NOT_FOUND when ULB exists but ward does not", async () => {
    const cache = new Map<string, GeoResolveResult>()
    const result = await resolveImportGeo(
      mockDb({
        ulb: { id: "u1", code: "800726", districtId: "d1", stateId: "s1" },
        wardUnderUlb: null,
      }),
      "800726",
      "05",
      cache
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("WARD_NOT_FOUND")
      expect(result.message).toMatch(/Ward master data is missing for ULB 800726/)
    }
  })

  it("returns WARD_OTHER_ULB when ward exists under a different ULB", async () => {
    const cache = new Map<string, GeoResolveResult>()
    const result = await resolveImportGeo(
      mockDb({
        ulb: { id: "u1", code: "800726", districtId: "d1", stateId: "s1" },
        wardUnderUlb: null,
        wardElsewhere: { id: "w9", wardNumber: "5", ulbId: "u2", ulbCode: "ETM" },
      }),
      "800726",
      "05",
      cache
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("WARD_OTHER_ULB")
      expect(result.otherUlbCode).toBe("ETM")
    }
  })

  it("resolves when ward matches any candidate form", async () => {
    const cache = new Map<string, GeoResolveResult>()
    const result = await resolveImportGeo(
      mockDb({
        ulb: { id: "u1", code: "800726", districtId: "d1", stateId: "s1" },
        wardUnderUlb: { id: "w1", wardNumber: "5", ulbId: "u1" },
      }),
      "800726",
      "05",
      cache
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.geo.wardId).toBe("w1")
      expect(result.geo.ulbCode).toBe("800726")
    }
  })
})
