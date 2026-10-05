import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { compareWardNumbers, sortWardsByNumber } from "./ward-order.ts"

describe("compareWardNumbers", () => {
  it("orders numeric ward numbers before a longer digit string and a letter suffix", () => {
    const ordered = ["10A", "2", "10", "0", "1"].sort(compareWardNumbers)
    assert.deepEqual(ordered, ["0", "1", "2", "10", "10A"])
  })

  it("places wards without a leading number after numeric wards", () => {
    assert.ok(compareWardNumbers("2", "Central") < 0)
    assert.ok(compareWardNumbers("Annex", "Central") < 0)
  })
})

describe("sortWardsByNumber", () => {
  it("sorts ward records by ward number without mutating the input", () => {
    const input = [
      { id: "c", wardNumber: "10" },
      { id: "a", wardNumber: "0" },
      { id: "d", wardNumber: "2" },
      { id: "b", wardNumber: "1" },
    ]
    const actual = sortWardsByNumber(input)
    assert.deepEqual(
      actual.map((ward) => ward.wardNumber),
      ["0", "1", "2", "10"]
    )
    assert.equal(input[0]?.wardNumber, "10")
  })
})
