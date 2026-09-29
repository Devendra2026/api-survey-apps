import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hasGoogleOAuthFactor,
  hasPasswordFactor,
  PASSWORD_RESET_UNAVAILABLE_GOOGLE_MESSAGE,
  PASSWORD_UNAVAILABLE_GOOGLE_MESSAGE,
  passwordResetUnavailableMessage,
  passwordUnavailableMessage,
  resolveClientTrustChannel,
  unsupportedClientTrustMessage,
} from "./sign-in-factors.ts"

describe("hasPasswordFactor", () => {
  it("returns true when password is listed", () => {
    assert.equal(hasPasswordFactor([{ strategy: "password" }, { strategy: "oauth_google" }]), true)
  })

  it("returns false when password is absent", () => {
    assert.equal(hasPasswordFactor([{ strategy: "oauth_google" }]), false)
    assert.equal(hasPasswordFactor(null), false)
    assert.equal(hasPasswordFactor(undefined), false)
    assert.equal(hasPasswordFactor([]), false)
  })
})

describe("hasGoogleOAuthFactor", () => {
  it("returns true for oauth_google", () => {
    assert.equal(hasGoogleOAuthFactor([{ strategy: "oauth_google" }]), true)
  })

  it("returns false otherwise", () => {
    assert.equal(hasGoogleOAuthFactor([{ strategy: "password" }]), false)
  })
})

describe("passwordUnavailableMessage", () => {
  it("points Google-only accounts to Continue with Google", () => {
    assert.equal(passwordUnavailableMessage([{ strategy: "oauth_google" }]), PASSWORD_UNAVAILABLE_GOOGLE_MESSAGE)
  })

  it("lists strategies when Google is not present", () => {
    assert.match(
      passwordUnavailableMessage([{ strategy: "email_code" }, { strategy: "phone_code" }]),
      /email_code, phone_code/
    )
  })

  it("uses a generic fallback when no factors are returned", () => {
    assert.match(passwordUnavailableMessage([]), /not available/)
  })
})

describe("passwordResetUnavailableMessage", () => {
  it("points Google-only accounts to Google sign-in", () => {
    assert.equal(
      passwordResetUnavailableMessage([{ strategy: "oauth_google" }]),
      PASSWORD_RESET_UNAVAILABLE_GOOGLE_MESSAGE
    )
  })
})

describe("resolveClientTrustChannel", () => {
  it("selects email_code when Clerk lists it for needs_client_trust", () => {
    assert.equal(resolveClientTrustChannel([{ strategy: "email_code" }, { strategy: "phone_code" }]), "email_code")
  })

  it("falls back to phone_code when email_code is absent", () => {
    assert.equal(resolveClientTrustChannel([{ strategy: "phone_code" }]), "phone_code")
  })

  it("returns null for email_link-only factors", () => {
    assert.equal(resolveClientTrustChannel([{ strategy: "email_link" }]), null)
  })

  it("returns null when no factors are listed", () => {
    assert.equal(resolveClientTrustChannel([]), null)
    assert.equal(resolveClientTrustChannel(null), null)
  })
})

describe("unsupportedClientTrustMessage", () => {
  it("explains email_link is unavailable in the mobile app", () => {
    assert.match(unsupportedClientTrustMessage([{ strategy: "email_link" }]), /email link/i)
    assert.doesNotMatch(unsupportedClientTrustMessage([{ strategy: "email_link" }]), /web admin/i)
  })
})
