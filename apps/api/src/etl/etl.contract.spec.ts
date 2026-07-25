import { describe, expect, it } from "@jest/globals"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { buildStorageKey } from "@workspace/etl-core"

describe("ETL API constants", () => {
  it("exposes etl:manage permission", () => {
    expect(PERMISSIONS.ETL_MANAGE).toBe("etl:manage")
  })
})

describe("ETL storage key contract", () => {
  it("matches production S3 layout", () => {
    expect(
      buildStorageKey({
        districtCode: "05",
        wardNo: "12",
        legacySurveyId: "SURVEY-100254",
        slot: "front",
        extension: "webp",
      })
    ).toBe("etah-images/district-05/ward-12/SURVEY-100254/front.webp")
  })
})
