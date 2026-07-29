import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { unwrapApiProfile } from "./unwrap-api-profile.ts"

describe("unwrapApiProfile", () => {
  it("unwraps Nest ApiResponse envelope", () => {
    const profile = unwrapApiProfile({
      success: true,
      message: "OK",
      data: { id: "u1", permissions: ["dashboard:view"] },
      errors: null,
      timestamp: "2026-01-01T00:00:00.000Z",
    })
    assert.deepEqual(profile, { id: "u1", permissions: ["dashboard:view"] })
  })

  it("returns null when envelope data is null", () => {
    assert.equal(
      unwrapApiProfile({
        success: true,
        message: "OK",
        data: null,
        errors: null,
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
      null
    )
  })

  it("passes through a raw profile object", () => {
    const raw = { permissions: ["user:view"] }
    assert.deepEqual(unwrapApiProfile(raw), raw)
  })

  it("returns null for non-objects", () => {
    assert.equal(unwrapApiProfile(null), null)
    assert.equal(unwrapApiProfile("x"), null)
  })
})
