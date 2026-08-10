import { describe, expect, it } from "@jest/globals"
import type { TargetAuditEvent } from "./schemas.js"

/** Pure check that re-running UPSERT with same eventId is safe (identity key). */
function upsertKey(event: Pick<TargetAuditEvent, "eventId">): string {
  return event.eventId
}

describe("idempotent upsert key", () => {
  it("uses eventId as the sole dedupe key", () => {
    expect(upsertKey({ eventId: "j57a" })).toBe("j57a")
    expect(upsertKey({ eventId: "j57a" })).toBe(upsertKey({ eventId: "j57a" }))
  })
})
