import {
  buildWardCandidates,
  canonicalWardNumber,
  checkPropertyIdGeoConsistency,
  collectWorkbookGeoPairs,
  formatDuplicateWorkbookError,
  formatMissingUlbMasterAbort,
  geoErrorMessage,
  normalizeImportString,
  resolveImportGeo,
  type GeoLookupDb,
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

  it("formats duplicate workbook errors with sheet and rows", () => {
    expect(formatDuplicateWorkbookError("propertyId", "800726-005-00041-001-R", [53, 371])).toBe(
      "Duplicate Property ID in workbook (Surveys sheet): 800726-005-00041-001-R (rows 53, 371)"
    )
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
        findFirst: async ({ where }) => {
          if (!options.ulb) return null
          if (where.code !== options.ulb.code && where.code !== "800726") return null
          return {
            id: options.ulb.id,
            code: options.ulb.code,
            districtId: options.ulb.districtId,
            district: { stateId: options.ulb.stateId },
          }
        },
      },
      ward: {
        findFirst: async (args) => {
          const where = args.where as { ulbId?: string; wardNumber: { in: string[] } }
          if (where.ulbId && options.wardUnderUlb) {
            return options.wardUnderUlb
          }
          if (where.ulbId && !options.wardUnderUlb) return null
          if (!where.ulbId && options.wardElsewhere) {
            return {
              id: options.wardElsewhere.id,
              wardNumber: options.wardElsewhere.wardNumber,
              ulbId: options.wardElsewhere.ulbId,
              ulb: { code: options.wardElsewhere.ulbCode },
            }
          }
          return null
        },
      },
    }
  }

  it("returns ULB_NOT_FOUND when master ULB is missing", async () => {
    const cache = new Map()
    const result = await resolveImportGeo(mockDb({ ulb: null }), "800726", "05", cache)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("ULB_NOT_FOUND")
      expect(result.message).toContain("ULB master data is missing")
      expect(result.message).toContain("800726")
    }
  })

  it("returns WARD_NOT_FOUND when ULB exists but ward does not", async () => {
    const cache = new Map()
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
    const cache = new Map()
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
    const cache = new Map()
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
