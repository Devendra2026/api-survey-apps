import { describe, expect, it } from "@jest/globals"
import { isFinalAttempt } from "./retry-policy.js"

describe("isFinalAttempt", () => {
  it("is false while the queue still has retries left", () => {
    expect(isFinalAttempt({ attemptsMade: 0, maxAttempts: 3 })).toBe(false)
    expect(isFinalAttempt({ attemptsMade: 1, maxAttempts: 3 })).toBe(false)
  })

  it("is true on the last allowed attempt", () => {
    expect(isFinalAttempt({ attemptsMade: 2, maxAttempts: 3 })).toBe(true)
  })

  it("treats a missing attempt budget as a single attempt", () => {
    expect(isFinalAttempt({ attemptsMade: 0, maxAttempts: undefined })).toBe(true)
    expect(isFinalAttempt({ attemptsMade: 0, maxAttempts: 1 })).toBe(true)
  })

  it("stays true when attempts overshoot the budget", () => {
    expect(isFinalAttempt({ attemptsMade: 9, maxAttempts: 3 })).toBe(true)
  })
})
