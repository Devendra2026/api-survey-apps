import { findWorkbookDuplicates } from "./convex-workbook-parser"

describe("findWorkbookDuplicates", () => {
  it("flags duplicate property and local IDs inside a workbook", () => {
    const issues = findWorkbookDuplicates([
      { "Property ID": "A-1", "Local ID": "L1" },
      { "Property ID": "A-1", "Local ID": "L2" },
      { "Property ID": "B-1", "Local ID": "L1" },
    ])

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "propertyId", key: "A-1", rows: [2, 3] }),
        expect.objectContaining({ kind: "localId", key: "L1", rows: [2, 4] }),
      ])
    )
  })
})
