import { describe, expect, it } from "@jest/globals"
import {
  clerkKeyKind,
  clerkKeysEnvironmentMismatch,
  resolveClerkEmailVerification,
  type ClerkUserEmailLike,
} from "./clerk-email-verification.js"

function user(partial: Partial<ClerkUserEmailLike>): ClerkUserEmailLike {
  return {
    primaryEmailAddressId: "idn_1",
    emailAddresses: [{ id: "idn_1", emailAddress: "Surveyor@Example.com", verification: null }],
    externalAccounts: [],
    ...partial,
  }
}

describe("resolveClerkEmailVerification", () => {
  it("accepts a verified primary email and normalizes it", () => {
    const result = resolveClerkEmailVerification(
      user({
        emailAddresses: [
          {
            id: "idn_1",
            emailAddress: "Surveyor@Example.com",
            verification: { status: "verified", strategy: "email_code" },
          },
        ],
      })
    )
    expect(result).toEqual(expect.objectContaining({ verified: true, via: "email", email: "surveyor@example.com" }))
  })

  it("accepts Google proof via the OAuth verification strategy on the email record", () => {
    const result = resolveClerkEmailVerification(
      user({
        emailAddresses: [
          {
            id: "idn_1",
            emailAddress: "surveyor@example.com",
            verification: { status: "transferable", strategy: "from_oauth_google" },
          },
        ],
      })
    )
    expect(result.verified).toBe(true)
    expect(result.via).toBe("oauth-strategy")
  })

  it("accepts a Google external account linked by identificationId without its own emailAddress", () => {
    const result = resolveClerkEmailVerification(
      user({
        externalAccounts: [
          {
            provider: "oauth_google",
            identificationId: "idn_1",
            emailAddress: "",
            verification: { status: "verified" },
          },
        ],
      })
    )
    expect(result.verified).toBe(true)
    expect(result.via).toBe("oauth-account")
    expect(result.providers).toEqual(["oauth_google"])
  })

  it("refuses an unverified email even when the strategy is OAuth", () => {
    const result = resolveClerkEmailVerification(
      user({
        emailAddresses: [
          {
            id: "idn_1",
            emailAddress: "surveyor@example.com",
            verification: { status: "unverified", strategy: "oauth_google" },
          },
        ],
      })
    )
    expect(result.verified).toBe(false)
  })

  it("refuses a Google account linked to a different address", () => {
    const result = resolveClerkEmailVerification(
      user({
        externalAccounts: [
          {
            provider: "oauth_google",
            identificationId: "idn_other",
            emailAddress: "someone.else@example.com",
            verification: { status: "verified" },
          },
        ],
      })
    )
    expect(result.verified).toBe(false)
  })

  it("refuses a linked Google account whose verification failed", () => {
    const result = resolveClerkEmailVerification(
      user({
        externalAccounts: [{ provider: "oauth_google", identificationId: "idn_1", verification: { status: "failed" } }],
      })
    )
    expect(result.verified).toBe(false)
  })

  it("is unverified when Clerk has no email", () => {
    expect(resolveClerkEmailVerification(user({ emailAddresses: [] })).verified).toBe(false)
  })
})

describe("clerk key kinds", () => {
  it("classifies keys without exposing them", () => {
    expect(clerkKeyKind("pk_test_abc")).toBe("pk_test")
    expect(clerkKeyKind("sk_live_abc")).toBe("sk_live")
    expect(clerkKeyKind("")).toBe("missing")
    expect(clerkKeyKind(undefined)).toBe("missing")
    expect(clerkKeyKind("nope")).toBe("unknown")
  })

  it("flags test/live mixing", () => {
    expect(clerkKeysEnvironmentMismatch("pk_test", "sk_live")).toBe(true)
    expect(clerkKeysEnvironmentMismatch("pk_live", "sk_live")).toBe(false)
    expect(clerkKeysEnvironmentMismatch("missing", "sk_live")).toBe(false)
  })
})
