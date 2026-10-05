import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { pinCodeOptions } from "./pin-code-options.ts"

describe("pinCodeOptions", () => {
  it("maps catalog codes to dropdown options and drops blanks and duplicates", () => {
    const actual = pinCodeOptions(["207001", " 207002 ", "", "207001"], null)
    assert.deepEqual(actual, [
      { value: "207001", label: "207001" },
      { value: "207002", label: "207002" },
    ])
  })

  it("prepends a saved PIN that is missing from the catalog", () => {
    const actual = pinCodeOptions(["207001"], "110001")
    assert.deepEqual(actual, [
      { value: "110001", label: "110001" },
      { value: "207001", label: "207001" },
    ])
  })

  it("does not duplicate a saved PIN that is already in the catalog", () => {
    const actual = pinCodeOptions(["207001", "207002"], " 207002 ")
    assert.deepEqual(actual, [
      { value: "207001", label: "207001" },
      { value: "207002", label: "207002" },
    ])
  })
})
