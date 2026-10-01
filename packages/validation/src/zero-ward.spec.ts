import { describe, expect, it } from "@jest/globals"
import { isSystemZeroWard } from "./zero-ward.js"

describe("isSystemZeroWard", () => {
  it("matches the generated Zero Ward by kind or exact name", () => {
    expect(isSystemZeroWard({ kind: "ZERO", wardName: "Quarantine" })).toBe(true)
    expect(isSystemZeroWard({ kind: "GEOGRAPHIC", wardName: "Zero Ward" })).toBe(true)
    expect(isSystemZeroWard({ kind: "GEOGRAPHIC", wardName: "  zero   ward " })).toBe(true)
  })

  it("does not match a similarly named user ward", () => {
    expect(isSystemZeroWard({ kind: "GEOGRAPHIC", wardName: "Zero Ward East" })).toBe(false)
    expect(isSystemZeroWard({ kind: "GEOGRAPHIC", wardName: "Central" })).toBe(false)
    expect(isSystemZeroWard({ kind: null, wardName: null })).toBe(false)
  })
})
