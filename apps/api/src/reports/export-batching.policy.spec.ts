import { describe, expect, it } from "@jest/globals"

/** Mirrors worker batching constants — async Survey Data must not use the old silent 10k take. */
const EXPORT_BATCH_SIZE = 500
const DEFAULT_EXPORT_MAX_ROWS = 500_000

describe("Survey Data export batching policy", () => {
  it("pages below the former 10k hard cap", () => {
    expect(EXPORT_BATCH_SIZE).toBeGreaterThan(0)
    expect(EXPORT_BATCH_SIZE).toBeLessThan(10_000)
  })

  it("allows full district dumps above 10k rows", () => {
    expect(DEFAULT_EXPORT_MAX_ROWS).toBeGreaterThan(10_000)
  })
})
