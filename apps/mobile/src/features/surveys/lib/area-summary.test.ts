import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { areaPairFromSource, parseAreaDraft, plinthSqFtFromFloors } from "./area-summary.ts"

describe("area pair conversion", () => {
  it("stores square feet and the GIS square meters", () => {
    assert.deepEqual(areaPairFromSource("sqFt", 100), { sqFt: 100, sqMeter: 9.2903 })
  })

  it("converts typed square meters back through square feet", () => {
    const pair = areaPairFromSource("sqMeter", 9.2903)
    assert.deepEqual(pair, { sqFt: 100, sqMeter: 9.2903 })
    const shifted = areaPairFromSource("sqMeter", 50)
    assert.equal(shifted.sqMeter, areaPairFromSource("sqFt", shifted.sqFt).sqMeter)
  })

  it("clears both units when the value is empty", () => {
    assert.deepEqual(areaPairFromSource("sqFt", null), { sqFt: null, sqMeter: null })
    assert.deepEqual(parseAreaDraft(""), { kind: "empty" })
    assert.deepEqual(parseAreaDraft("10."), { kind: "pending", value: 10 })
    assert.deepEqual(parseAreaDraft("nope"), { kind: "invalid" })
  })
})

describe("plinth from ground floor", () => {
  it("sums countable ground-floor rows", () => {
    assert.equal(
      plinthSqFtFromFloors([
        { floorPosition: "GROUND_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 100 },
        { floorPosition: "GROUND_FLOOR", usageFactor: "COMMERCIAL", areaSqFt: 50 },
        { floorPosition: "FIRST_FLOOR", usageFactor: "RESIDENTIAL", areaSqFt: 80 },
      ]),
      150
    )
  })

  it("ignores open-land rows and returns null when no ground floor remains", () => {
    assert.equal(
      plinthSqFtFromFloors([
        { floorPosition: "GROUND_FLOOR", usageFactor: "OPEN_LAND", areaSqFt: 500 },
        { floorPosition: "OPEN_LAND", usageFactor: "RESIDENTIAL", areaSqFt: 40 },
      ]),
      null
    )
    assert.equal(plinthSqFtFromFloors([]), null)
  })
})
