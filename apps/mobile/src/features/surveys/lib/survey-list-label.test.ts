import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { surveyListLabel } from "./survey-list-label.ts"

describe("surveyListLabel", () => {
  it("hides a temporary mobile id and leads with the house number", () => {
    const actual = surveyListLabel({
      propertyId: "TEMP-MOBILE-D6B16C44C0E34872",
      houseDoorNo: "48-A",
      respondentName: "Rama Devi",
      wardNumber: "1",
    })
    assert.deepEqual(actual, { title: "48-A", subtitle: "Rama Devi · Ward 1" })
  })

  it("uses the respondent when the house number is missing", () => {
    const actual = surveyListLabel({
      propertyId: "TEMP-MOBILE-0F8FAD5BD9CB469F",
      houseDoorNo: "  ",
      respondentName: "Rama Devi",
      wardNumber: "12",
    })
    assert.deepEqual(actual, { title: "Rama Devi", subtitle: "Ward 12" })
  })

  it("falls back to Draft when house and respondent are empty", () => {
    const actual = surveyListLabel({
      propertyId: "TEMP-MOBILE-0F8FAD5BD9CB469F",
      houseDoorNo: null,
      respondentName: null,
      wardNumber: null,
    })
    assert.deepEqual(actual, { title: "Draft", subtitle: "Ward —" })
  })

  it("shows the generated property id once it exists", () => {
    const actual = surveyListLabel({
      propertyId: "801262-001-00747-001-R",
      houseDoorNo: "48-A",
      respondentName: "Rama Devi",
      wardNumber: "1",
    })
    assert.deepEqual(actual, {
      title: "801262-001-00747-001-R",
      subtitle: "48-A · Rama Devi · Ward 1",
    })
  })
})
