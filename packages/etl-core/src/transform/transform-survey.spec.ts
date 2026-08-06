import { createHash } from "node:crypto"
import { describe, expect, it } from "@jest/globals"
import {
  buildStorageKey,
  classifyError,
  computeChecksum,
  shouldSkipSurvey,
  transformSurveyBundle,
  validateImageBuffer,
  type ConvexSurveyBundle,
  type TransformContext,
} from "../index"

function fixtureBundle(overrides: Partial<ConvexSurveyBundle> = {}): ConvexSurveyBundle {
  return {
    _id: "j57abc123",
    _creationTime: Date.now(),
    localId: "local-1",
    surveyorId: "user1",
    surveyorClerkId: "clerk_1",
    surveyorEmail: "s@example.com",
    surveyorName: "Surveyor",
    districtId: "d1",
    districtCode: "05",
    districtName: "Etah",
    municipalityId: "m1",
    municipalityCode: "ETAH-NP",
    municipalityName: "Etah NP",
    wardNo: "12",
    status: "submitted",
    qcStatus: "pending",
    serverVersion: 1,
    clientUpdatedAt: Date.now(),
    parcelNo: "P-1",
    unitNo: "1",
    isSlum: false,
    mobileNo: "9999999999",
    locality: "Main",
    colonyName: "Colony",
    city: "Etah",
    pinCode: "207001",
    assessmentYear: "2025-2026",
    ownershipType: "individual",
    propertyType: "residential_self",
    propertyUse: "residential",
    situation: "interior",
    roadType: "rcc",
    taxRateZone: "below_9m",
    plotSqft: 1000,
    plinthSqft: 800,
    municipalWaterConnection: true,
    waterSource: "government_tap",
    sanitationType: "septic_tank",
    municipalWasteCollection: true,
    floors: [],
    photos: [
      {
        slot: "front",
        sizeKb: 120,
        capturedAt: Date.now(),
        url: "https://convex.example/storage/front",
      },
    ],
    ...overrides,
  }
}

const ctx: TransformContext = {
  systemUserId: "system-user",
  resolveGeo: () => ({
    stateId: "st1",
    districtId: "di1",
    ulbId: "ulb1",
    wardId: "w1",
    districtCode: "05",
    wardNo: "12",
  }),
  resolveUserId: () => "user-nest-1",
}

describe("buildStorageKey", () => {
  it("builds etah-images district/ward/survey/slot path", () => {
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

describe("shouldSkipSurvey", () => {
  it("skips COMPLETED and SKIPPED only", () => {
    expect(shouldSkipSurvey("COMPLETED")).toBe(true)
    expect(shouldSkipSurvey("SKIPPED")).toBe(true)
    expect(shouldSkipSurvey("FAILED")).toBe(false)
    expect(shouldSkipSurvey("PENDING")).toBe(false)
  })
})

describe("transformSurveyBundle", () => {
  it("maps convex _id to legacySurveyId and skips duplicates by status only", () => {
    const skip = transformSurveyBundle(fixtureBundle(), ctx, { existingStatus: "COMPLETED" })
    expect(skip.ok).toBe(true)
    if (skip.ok && "skip" in skip) {
      expect(skip.skip).toBe(true)
      expect(skip.reason).toBe("duplicate")
    }

    const ok = transformSurveyBundle(fixtureBundle(), ctx)
    expect(ok.ok).toBe(true)
    if (ok.ok && "survey" in ok && ok.survey) {
      expect(ok.survey.legacySurveyId).toBe("j57abc123")
      expect(ok.survey.photos[0]?.objectKey).toContain("etah-images/district-05/ward-12/")
      expect(ok.survey.checksum).toHaveLength(64)
    }
  })

  it("imports incomplete drafts with ward and assessment-year placeholders", () => {
    const result = transformSurveyBundle(
      fixtureBundle({
        status: "draft",
        wardNo: "",
        assessmentYear: "",
        parcelNo: "",
        propertyId: undefined,
        mobileNo: "",
        locality: "",
      }),
      ctx
    )
    expect(result.ok).toBe(true)
    if (result.ok && "survey" in result && result.survey) {
      expect(result.survey.surveyStatus).toBe("DRAFT")
      expect(result.survey.wardNumber).toBe("00")
      expect(result.survey.assessmentYear).toBe("AY_2025_2026")
      expect(result.survey.propertyId).toBe("LOCAL-1")
    }
  })

  it("still rejects finished surveys that lack ward or assessment year", () => {
    const result = transformSurveyBundle(
      fixtureBundle({
        status: "submitted",
        wardNo: "",
        assessmentYear: "",
      }),
      ctx
    )
    expect(result.ok).toBe(true)
    if (result.ok && "skip" in result) {
      expect(result.skip).toBe(true)
      expect(result.reason).toMatch(/incomplete/)
    }
  })

  it("fails transform when Convex status is missing instead of defaulting to SUBMITTED", () => {
    const result = transformSurveyBundle(fixtureBundle({ status: undefined as unknown as "submitted" }), ctx)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/surveyStatus|status/i)
    }
  })

  it("maps draft to DRAFT", () => {
    const result = transformSurveyBundle(fixtureBundle({ status: "draft", wardNo: "" }), ctx)
    expect(result.ok).toBe(true)
    if (result.ok && !("skip" in result)) {
      expect(result.survey.surveyStatus).toBe("DRAFT")
    }
  })
})

describe("validateImageBuffer", () => {
  it("accepts jpeg magic bytes", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    const result = validateImageBuffer(jpeg)
    expect(result.ok).toBe(true)
    expect(result.mimeType).toBe("image/jpeg")
  })

  it("rejects empty buffer", () => {
    expect(validateImageBuffer(Buffer.alloc(0)).ok).toBe(false)
  })
})

describe("classifyError", () => {
  it("classifies MIME failures as permanent", () => {
    expect(classifyError(new Error("MIME type not allowed: image/gif"))).toBe("permanent")
  })
  it("classifies timeouts as transient", () => {
    expect(classifyError(new Error("connect ETIMEDOUT"))).toBe("transient")
  })
})

describe("computeChecksum", () => {
  it("is stable for key order", () => {
    const a = computeChecksum({ b: 1, a: 2 })
    const b = computeChecksum({ a: 2, b: 1 })
    expect(a).toBe(b)
    expect(a).toBe(createHash("sha256").update(JSON.stringify({ a: 2, b: 1 })).digest("hex"))
  })
})
