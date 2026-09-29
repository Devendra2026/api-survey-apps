import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { missingFloorFields } from "./floor-draft.ts"

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
      ],
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
      [],
    )
  })
})
