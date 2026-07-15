import { formatDuplicateWorkbookError } from "@workspace/validation"
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

  it("enriches duplicate messages with Surveys sheet and row list", () => {
    const issues = findWorkbookDuplicates([
      { "Property ID": "800726-005-00041-001-R" },
      { "Property ID": "800726-005-00041-001-R" },
    ])
    const issue = issues.find((item) => item.kind === "propertyId")
    expect(issue).toBeDefined()
    expect(formatDuplicateWorkbookError(issue!.kind, issue!.key, issue!.rows)).toContain("Surveys sheet")
    expect(formatDuplicateWorkbookError(issue!.kind, issue!.key, issue!.rows)).toContain("rows 2, 3")
  })
})
