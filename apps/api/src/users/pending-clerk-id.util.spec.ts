import { describe, expect, it } from "@jest/globals"
import { isPendingClerkUserId, normalizeEmail, pendingClerkUserId } from "./pending-clerk-id.util.js"

describe("pending-clerk-id.util", () => {
  it("normalizes email", () => {
    expect(normalizeEmail("  Jane.Doe@Example.COM ")).toBe("jane.doe@example.com")
  })

  it("builds pending placeholder ids", () => {
    expect(pendingClerkUserId("Jane@Example.com")).toBe("pending:jane@example.com")
    expect(isPendingClerkUserId("pending:jane@example.com")).toBe(true)
    expect(isPendingClerkUserId("user_abc")).toBe(false)
  })
})
