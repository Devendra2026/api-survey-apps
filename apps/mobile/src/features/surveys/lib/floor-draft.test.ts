import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isDuplicateFloor, missingFloorFields } from "./floor-draft.ts"

describe("floor draft", () => {
  it("lists every required field while the draft is empty", () => {
    assert.deepEqual(
      missingFloorFields({
        position: null,
        area: null,
        usageFactor: null,
        usageType: null,
        construction: null,
      }),
      [
        "Floor no. is required.",
        "Floor area is required.",
        "Usage factor is required.",
        "Usage type is required.",
        "Construction type is required.",
      ]
    )
  })

  it("is ready when every required field is set", () => {
    assert.deepEqual(
      missingFloorFields({
        position: "GROUND_FLOOR",
        area: 1000,
        usageFactor: "RESIDENTIAL",
        usageType: "SELF_OCCUPIED",
        construction: "PAKKA_RCC",
      }),
      []
    )
  })

  it("rejects a floor that repeats position, usage factor, and construction", () => {
    const floors = [
      {
        id: "floor-1",
        floorPosition: "GROUND_FLOOR",
        usageFactor: "RESIDENTIAL",
        constructionType: "PAKKA_BUILDING_WITH_RCC_ROOF",
      },
    ]
    assert.equal(
      isDuplicateFloor(floors, {
        id: null,
        floorPosition: "GROUND_FLOOR",
        usageFactor: "RESIDENTIAL",
        constructionType: "PAKKA_BUILDING_WITH_RCC_ROOF",
      }),
      true
    )
    assert.equal(
      isDuplicateFloor(floors, {
        id: "floor-1",
        floorPosition: "GROUND_FLOOR",
        usageFactor: "RESIDENTIAL",
        constructionType: "PAKKA_BUILDING_WITH_RCC_ROOF",
      }),
      false
    )
  })
})
