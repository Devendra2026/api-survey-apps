import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { AuthenticatedProfile, TenantRole } from "../../../types/user.ts"
import type { SurveyEditableFields } from "../types.ts"
import { hasActiveRole, surveyAssignments, temporaryPropertyId } from "./assignments.ts"
import { defaultAssessmentYear, humanizeEnum, optionLabel } from "./labels.ts"
import { canSubmit, fieldBucket, isAlreadySubmittedError, isFieldEditable, needsReopenBeforeEdit } from "./lifecycle.ts"
import { applyPatch, mergePatch, recordToFields, sanitizePatch, subtractSentPatch } from "./patch.ts"
import {
  isStepId,
  stepForRemarkSection,
  stepForServerMessage,
  stepProgress,
  submitRequirements,
  type SurveySnapshot,
} from "./requirements.ts"
import { hasUnsyncedChanges, syncChip, syncReducer, type SyncStatus } from "./sync-state.ts"

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

const complete = (): SurveySnapshot =>
  snapshot({
    ownershipType: "INDIVIDUAL",
    propertyUse: "RESIDENTIAL",
    propertyType: "RESIDENTIAL_SELF",
    floorCount: 1,
    latitude: 26.1,
    longitude: 80.2,
    uploadedPhotoTypes: ["FRONT"],
  })

describe("lifecycle", () => {
  it("maps the two-axis status onto field buckets", () => {
    assert.equal(fieldBucket("DRAFT", "PENDING"), "draft")
    assert.equal(fieldBucket("IN_PROGRESS", "PENDING"), "draft")
    assert.equal(fieldBucket("SUBMITTED", "PENDING"), "pendingQc")
    assert.equal(fieldBucket("SUBMITTED", "APPROVED"), "approved")
    assert.equal(fieldBucket("APPROVED", "APPROVED"), "approved")
    assert.equal(fieldBucket("REJECTED", "REJECTED"), "needsCorrection")
    assert.equal(fieldBucket("REOPENED", "REJECTED"), "needsCorrection")
  })

  it("matches the API EDITABLE set and reopen rule", () => {
    assert.deepEqual(
      (["DRAFT", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED", "REOPENED"] as const).filter(isFieldEditable),
      ["DRAFT", "IN_PROGRESS", "REOPENED"]
    )
    assert.equal(needsReopenBeforeEdit("REJECTED"), true)
    assert.equal(needsReopenBeforeEdit("REOPENED"), false)
    assert.equal(canSubmit("SUBMITTED"), false)
  })

  it("recognises the duplicate-submit server message", () => {
    assert.equal(isAlreadySubmittedError("Cannot submit survey in status SUBMITTED"), true)
    assert.equal(isAlreadySubmittedError("Survey requires at least one floor"), false)
  })
})

describe("sync state", () => {
  const run = (events: Parameters<typeof syncReducer>[1][]): SyncStatus =>
    events.reduce<SyncStatus>((s, e) => syncReducer(s, e), { kind: "idle" })

  it("goes dirty → saving → synced", () => {
    const s = run([{ type: "edit" }, { type: "saveStart" }, { type: "saveSuccess", at: 1, hasMoreChanges: false }])
    assert.deepEqual(s, { kind: "synced", at: 1 })
    assert.equal(hasUnsyncedChanges(s), false)
  })

  it("stays dirty when edits arrived during a save", () => {
    const s = run([{ type: "saveStart" }, { type: "edit" }, { type: "saveSuccess", at: 1, hasMoreChanges: true }])
    assert.equal(s.kind, "dirty")
    assert.equal(hasUnsyncedChanges(s), true)
  })

  it("separates offline from rejected saves and offers retry", () => {
    const offline = run([{ type: "saveError", message: "net", network: true }])
    const failed = run([{ type: "saveError", message: "bad", network: false }])
    assert.equal(offline.kind, "offline")
    assert.equal(failed.kind, "failed")
    assert.equal(syncChip(offline).canRetry, true)
    assert.equal(syncChip(failed).tone, "danger")
  })
})

describe("submit requirements", () => {
  it("lists every missing API rule, tagged with its step", () => {
    const reqs = submitRequirements(snapshot({ propertyId: " " }))
    assert.deepEqual(
      reqs.map((r) => r.step),
      ["taxation", "taxation", "taxation", "taxation", "area", "gps", "photos"]
    )
  })

  it("is empty for a complete survey", () => {
    assert.deepEqual(submitRequirements(complete()), [])
  })

  it("requires a co-owner for JOINT ownership", () => {
    const reqs = submitRequirements({ ...complete(), ownershipType: "JOINT" })
    assert.deepEqual(reqs, [{ step: "owner", message: "Joint ownership needs at least one co-owner" }])
    assert.deepEqual(submitRequirements({ ...complete(), ownershipType: "JOINT", coOwnerCount: 1 }), [])
  })

  it("counts only confirmed photo types", () => {
    const p = stepProgress({ ...complete(), uploadedPhotoTypes: ["FRONT", "FRONT", "SIDE"] })
    assert.deepEqual(p.photos, { filled: 2, total: 2, missing: [] })
  })

  it("routes server messages and remark sections to steps", () => {
    assert.equal(stepForServerMessage("Survey requires at least one FRONT photo"), "photos")
    assert.equal(stepForServerMessage("Survey requires GPS latitude and longitude"), "gps")
    assert.equal(stepForServerMessage("JOINT ownership requires at least one co-owner"), "owner")
    assert.equal(stepForServerMessage("Survey requires valid property details"), "property")
    assert.equal(stepForRemarkSection("address", "wrong pin"), "address")
    assert.equal(stepForRemarkSection("unknown", "floor area wrong"), "area")
    assert.equal(isStepId("photos"), true)
    assert.equal(isStepId("nope"), false)
  })
})

describe("patch", () => {
  it("drops unknown keys and wrong types from stored data", () => {
    const clean = sanitizePatch({
      respondentName: "Asha",
      familySize: "4",
      plotAreaSqFt: 120.5,
      ownershipType: "NOT_A_TYPE",
      propertyUse: "RESIDENTIAL",
      propertyId: "",
      assessmentYear: "AY_2025_2026",
      solidWasteCollection: true,
      sectorNo: "3",
      constructedYear: 1998,
      isSlum: false,
      wardId: " ward-9 ",
      userId: "attacker",
      gpsSource: "MANUAL",
    })
    assert.deepEqual(clean, {
      respondentName: "Asha",
      plotAreaSqFt: 120.5,
      propertyUse: "RESIDENTIAL",
      assessmentYear: "AY_2025_2026",
      solidWasteCollection: true,
      sectorNo: "3",
      constructedYear: 1998,
      isSlum: false,
      wardId: "ward-9",
    })
    assert.deepEqual(sanitizePatch({ constructedYear: 1700, wardId: "  " }), {})
    assert.deepEqual(sanitizePatch("garbage"), {})
    assert.deepEqual(sanitizePatch(null), {})
  })

  it("keeps edits made while a save was in flight", () => {
    const sent = { respondentName: "A", locality: "X" }
    const pending = mergePatch(sent, { respondentName: "AB" })
    assert.deepEqual(subtractSentPatch(pending, sent), { respondentName: "AB" })
  })

  it("applies pending edits on top of server values without leaking gpsSource", () => {
    const base = recordToFields(fields({ latitude: "26.1234567", plotAreaSqFt: "100.50" }))
    assert.equal(base.latitude, 26.1234567)
    assert.equal(base.plotAreaSqFt, 100.5)
    const view = applyPatch(base, { locality: "Civil Lines", gpsSource: "DEVICE" })
    assert.equal(view.locality, "Civil Lines")
    assert.equal("gpsSource" in view, false)
  })
})

describe("labels", () => {
  it("humanizes enums and applies overrides", () => {
    assert.equal(humanizeEnum("PAKKA_BUILDING_WITH_RCC_ROOF"), "Pakka building with RCC roof")
    assert.equal(optionLabel("FRONT"), "Front view")
  })

  it("picks the April–March assessment year", () => {
    const years = ["AY_2025_2026", "AY_2026_2027"] as const
    assert.equal(defaultAssessmentYear(years, new Date(2026, 2, 31)), "AY_2025_2026")
    assert.equal(defaultAssessmentYear(years, new Date(2026, 3, 1)), "AY_2026_2027")
    assert.equal(defaultAssessmentYear(years, new Date(2030, 5, 1)), "AY_2026_2027")
  })
})

describe("assignments", () => {
  function role(name: string, geo: Partial<TenantRole>, isActive = true): TenantRole {
    return { id: `utr_${name}_${geo.wardId ?? geo.ulbId ?? "x"}`, role: { id: name, name }, isActive, ...geo }
  }
  function profile(roles: TenantRole[]): AuthenticatedProfile {
    return {
      id: "u1",
      clerkUserId: "user_1",
      email: "a@b.c",
      fullName: "A",
      isActive: true,
      permissions: ["survey:create"],
      tenantRoles: roles,
    }
  }
  const geo = { stateId: "s1", districtId: "d1", ulbId: "u1", ulb: { id: "u1", name: "Ulb One" } }

  it("lists ward roles and collapses them under a ULB-wide role", () => {
    const wardOnly = surveyAssignments(
      profile([role("SURVEYOR", { ...geo, wardId: "w1", ward: { id: "w1", wardNumber: "1", wardName: "One" } })])
    )
    assert.equal(wardOnly.length, 1)
    assert.equal(wardOnly[0]?.wardId, "w1")

    const mixed = surveyAssignments(profile([role("SURVEYOR", { ...geo, wardId: "w1" }), role("SURVEYOR", { ...geo })]))
    assert.deepEqual(
      mixed.map((a) => a.wardId),
      [null]
    )
  })

  it("ignores inactive, pending and incomplete-geography roles", () => {
    const out = surveyAssignments(
      profile([
        role("SURVEYOR", { ...geo, wardId: "w1" }, false),
        role("PENDING_APPROVAL", { ...geo, wardId: "w2" }),
        role("SURVEYOR", { stateId: "s1" }),
      ])
    )
    assert.deepEqual(out, [])
    assert.equal(hasActiveRole(profile([role("SURVEYOR", geo, false)]), "SURVEYOR"), false)
  })

  it("builds a TEMP property id the API upgrades to the formula id", () => {
    const id = temporaryPropertyId("0f8fad5b-d9cb-469f-a165-70867728950e")
    assert.equal(id, "TEMP-MOBILE-0F8FAD5BD9CB469F")
    assert.ok(id.length <= 100)
  })
})
