import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createRequestGenerationGate, parseTaxPreviewRequestKey, taxPreviewRequestKey } from "./tax-preview-request.ts"

describe("taxPreviewRequestKey", () => {
  it("returns null when required fields are missing", () => {
    assert.equal(
      taxPreviewRequestKey({
        wardId: "",
        assessmentYearId: "ay1",
        areaSqFt: 100,
        roadWidthEntryId: "z1",
        constructionEntryId: "c1",
      }),
      null
    )
  })

  it("builds a stable key for identical inputs", () => {
    const a = taxPreviewRequestKey({
      wardId: "w1",
      assessmentYearId: "ay1",
      areaSqFt: 394,
      roadWidthEntryId: "z1",
      constructionEntryId: "c1",
    })
    const b = taxPreviewRequestKey({
      wardId: "w1",
      assessmentYearId: "ay1",
      areaSqFt: 394,
      roadWidthEntryId: "z1",
      constructionEntryId: "c1",
    })
    assert.equal(a, b)
    assert.equal(a, "w1|ay1|394|z1|c1")
  })

  it("changes key when area changes (debounce should coalesce rapid edits)", () => {
    const a = taxPreviewRequestKey({
      wardId: "w1",
      assessmentYearId: "ay1",
      areaSqFt: 100,
      roadWidthEntryId: "z1",
      constructionEntryId: "c1",
    })
    const b = taxPreviewRequestKey({
      wardId: "w1",
      assessmentYearId: "ay1",
      areaSqFt: 200,
      roadWidthEntryId: "z1",
      constructionEntryId: "c1",
    })
    assert.notEqual(a, b)
  })

  it("round-trips through parseTaxPreviewRequestKey", () => {
    const key = taxPreviewRequestKey({
      wardId: "w1",
      assessmentYearId: "ay1",
      areaSqFt: 394,
      roadWidthEntryId: "z1",
      constructionEntryId: "c1",
    })
    assert.ok(key)
    assert.deepEqual(parseTaxPreviewRequestKey(key!), {
      wardId: "w1",
      assessmentYearId: "ay1",
      areaSqFt: 394,
      roadWidthEntryId: "z1",
      constructionEntryId: "c1",
    })
  })
})

describe("createRequestGenerationGate", () => {
  it("only the latest generation is current", () => {
    const gate = createRequestGenerationGate()
    const first = gate.next()
    const second = gate.next()
    assert.equal(gate.isCurrent(first), false)
    assert.equal(gate.isCurrent(second), true)
    gate.invalidate()
    assert.equal(gate.isCurrent(second), false)
  })
})
