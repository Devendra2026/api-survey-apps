import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { SurveyEditableFields } from "../types.ts"
import {
  canAdvanceFromStep,
  canSelectStep,
  nextStepId,
  overallCompletionPercent,
  previousStepId,
  stepOrdinal,
} from "./navigation.ts"
import { stepProgress, type StepId, type SurveySnapshot } from "./requirements.ts"

function fields(overrides: Partial<SurveyEditableFields> = {}): SurveyEditableFields {
  return {
    propertyId: "P-1",
    wardId: "w1",
    parcelNumber: null,
    sectorNo: null,
    constructedYear: null,
    isSlum: false,
    unitSubNo: null,
    propertyIdOld: null,
    respondentName: null,
    relationshipWithOwner: null,
    mobileNumber: null,
    alternateMobile: null,
    familySize: null,
    houseDoorNo: null,
    locality: null,
    colony: null,
    city: null,
    pinCode: null,
    ownershipType: null,
    propertyUse: null,
    propertyType: null,
    situation: null,
    roadType: null,
    taxRateZone: null,
    assessmentYear: "AY_2026_2027",
    plotAreaSqFt: null,
    plinthAreaSqFt: null,
    waterConnection: null,
    sourceOfWater: null,
    sanitationType: null,
    solidWasteCollection: null,
    latitude: null,
    longitude: null,
    gpsAccuracyMeters: null,
    capturedAt: null,
    ...overrides,
  }
}

function snapshot(overrides: Partial<SurveySnapshot> = {}): SurveySnapshot {
  return {
    ...fields(),
    wardLabel: "1 · Ward One",
    floorCount: 0,
    coOwnerCount: 0,
    uploadedPhotoTypes: [],
    ...overrides,
  }
}

describe("survey navigation", () => {
  it("keeps chip jumps free (existing field workflow)", () => {
    const progress = stepProgress(snapshot())
    assert.equal(canSelectStep("property", "gps", progress).allowed, true)
    assert.equal(canSelectStep("gps", "property", progress).allowed, true)
  })

  it("blocks Next on Property until parcel and unit are valid", () => {
    const progress = stepProgress(snapshot({ parcelNumber: null, unitSubNo: null }))
    const gate = canAdvanceFromStep("property", progress)
    assert.equal(gate.allowed, false)
    if (!gate.allowed) {
      assert.equal(gate.reason, "Select a ward and enter valid parcel and unit numbers to continue.")
    }
  })

  it("allows Next on Property when ward, parcel, and unit are valid", () => {
    const progress = stepProgress(snapshot({ parcelNumber: "00747", unitSubNo: "001" }))
    assert.equal(canAdvanceFromStep("property", progress).allowed, true)
  })

  it("blocks Next on Taxation until ownership, use, and type are set", () => {
    const progress = stepProgress(
      snapshot({
        parcelNumber: "00747",
        unitSubNo: "001",
        ownershipType: null,
        propertyUse: null,
        propertyType: null,
        propertyId: " ",
      })
    )
    const gate = canAdvanceFromStep("taxation", progress)
    assert.equal(gate.allowed, false)
    if (!gate.allowed) {
      assert.match(gate.reason, /Ownership type/)
      assert.match(gate.reason, /Property use/)
      assert.match(gate.reason, /Property type/)
      assert.match(gate.reason, /Property ID/)
    }
  })

  it("allows Next when current step has no submit blockers", () => {
    const progress = stepProgress(
      snapshot({
        parcelNumber: "00747",
        unitSubNo: "001",
        ownershipType: "INDIVIDUAL",
        propertyUse: "RESIDENTIAL",
        propertyType: "RESIDENTIAL_SELF",
        relationshipWithOwner: "Self",
        floorCount: 1,
        latitude: 1,
        longitude: 2,
        uploadedPhotoTypes: ["FRONT"],
      })
    )
    assert.equal(canAdvanceFromStep("property", progress).allowed, true)
  })

  it("computes ordinals and neighbors", () => {
    assert.deepEqual(stepOrdinal("start"), { index: 1, total: 9, label: "Step 1 of 9" })
    assert.equal(nextStepId("start"), "property")
    assert.equal(previousStepId("property"), "start")
    assert.equal(nextStepId("photos"), null)
    assert.equal(previousStepId("start"), null)
  })

  it("reports overall completion percent", () => {
    const empty = overallCompletionPercent(stepProgress(snapshot({ propertyId: "" })))
    const fuller = overallCompletionPercent(
      stepProgress(
        snapshot({
          ownershipType: "INDIVIDUAL",
          propertyUse: "RESIDENTIAL",
          propertyType: "RESIDENTIAL_SELF",
          floorCount: 1,
          latitude: 1,
          longitude: 2,
          uploadedPhotoTypes: ["FRONT", "SIDE"],
        })
      )
    )
    assert.ok(empty >= 0 && empty <= 100)
    assert.ok(fuller > empty)
  })

  it("lists every StepId for exhaustiveness of neighbors", () => {
    const steps: StepId[] = ["start", "property", "owner", "address", "taxation", "area", "services", "gps", "photos"]
    assert.equal(steps.length, 9)
  })
})
