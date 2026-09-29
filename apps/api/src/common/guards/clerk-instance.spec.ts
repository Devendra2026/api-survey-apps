import { describe, expect, it } from "@jest/globals"
import { UnauthorizedException } from "@nestjs/common"
import {
  assertSessionAuthorizedParty,
  classifyTokenVerificationError,
  formatSessionTokenDiagnostics,
  sessionTokenDiagnostics,
  unauthorizedMessageForVerifyKind,
} from "./clerk-instance.js"

describe("assertSessionAuthorizedParty", () => {
  const webParties = ["https://admin.sdvedutech.in", "https://portal.nppetah.in"]

  it("accepts a missing azp when an allowlist is configured (Expo/native)", () => {
    expect(() => assertSessionAuthorizedParty(undefined, webParties)).not.toThrow()
  })

  it("accepts an empty azp when an allowlist is configured", () => {
    expect(() => assertSessionAuthorizedParty("   ", webParties)).not.toThrow()
  })

  it("accepts a listed web azp", () => {
    expect(() => assertSessionAuthorizedParty("https://admin.sdvedutech.in", webParties)).not.toThrow()
  })

  it("rejects an azp that is not on the allowlist", () => {
    expect(() => assertSessionAuthorizedParty("https://evil.example", webParties)).toThrow(UnauthorizedException)
    expect(() => assertSessionAuthorizedParty("https://evil.example", webParties)).toThrow(/authorized party/i)
  })

  it("skips enforcement when the allowlist is empty", () => {
    expect(() => assertSessionAuthorizedParty("https://evil.example", [])).not.toThrow()
    expect(() => assertSessionAuthorizedParty(undefined, [])).not.toThrow()
  })
})

describe("session token diagnostics", () => {
  it("formats log-safe claims without inventing values", () => {
    const d = sessionTokenDiagnostics({
      iss: "https://clerk.sdvedutech.in",
      azp: "https://admin.sdvedutech.in",
      sub: "user_abc",
      sid: "sess_xyz",
    })
    expect(formatSessionTokenDiagnostics(d)).toBe(
      "iss=https://clerk.sdvedutech.in azp=https://admin.sdvedutech.in sub=user_abc sid=sess_xyz"
    )
  })

  it("marks absent claims explicitly", () => {
    expect(formatSessionTokenDiagnostics(sessionTokenDiagnostics({}))).toBe(
      "iss=absent azp=absent sub=absent sid=absent"
    )
  })
})

describe("unauthorizedMessageForVerifyKind", () => {
  it("returns distinct copy for expired, azp, and invalid failures", () => {
    expect(unauthorizedMessageForVerifyKind("expired")).toMatch(/expired/i)
    expect(unauthorizedMessageForVerifyKind("authorized_party")).toMatch(/CLERK_AUTHORIZED_PARTIES/)
    expect(unauthorizedMessageForVerifyKind("invalid")).toMatch(/same Clerk instance/i)
  })
})

describe("classifyTokenVerificationError", () => {
  it("classifies UnauthorizedException authorized-party messages", () => {
    expect(
      classifyTokenVerificationError(
        new UnauthorizedException(
          "Session token authorized party is not allowed for this API. Ask an administrator to review CLERK_AUTHORIZED_PARTIES."
        )
      )
    ).toBe("authorized_party")
  })
})
