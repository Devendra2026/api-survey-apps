import { describe, expect, it } from "@jest/globals"
import { floorToUtcHour, listHourWindows } from "./verify_migration.js"

describe("verify_migration windows", () => {
  it("floors to UTC hour", () => {
    expect(floorToUtcHour(Date.UTC(2026, 7, 10, 12, 34, 56))).toBe(Date.UTC(2026, 7, 10, 12, 0, 0))
  })

  it("lists contiguous hour buckets ending at current hour floor", () => {
    const nowMs = Date.UTC(2026, 7, 10, 15, 20, 0)
    const windows = listHourWindows(3, nowMs)
    expect(windows).toEqual([
      { windowStartMs: Date.UTC(2026, 7, 10, 12, 0, 0), windowEndMs: Date.UTC(2026, 7, 10, 13, 0, 0) },
      { windowStartMs: Date.UTC(2026, 7, 10, 13, 0, 0), windowEndMs: Date.UTC(2026, 7, 10, 14, 0, 0) },
      { windowStartMs: Date.UTC(2026, 7, 10, 14, 0, 0), windowEndMs: Date.UTC(2026, 7, 10, 15, 0, 0) },
    ])
  })
})
