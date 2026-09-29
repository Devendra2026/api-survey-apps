import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEVICE_MUST_BE_VERIFIED_MESSAGE,
  ENTER_DEVICE_TRUST_CODE_MESSAGE,
  EXPIRED_VERIFICATION_CODE_MESSAGE,
  extractClerkRetryAfterSeconds,
  incompleteAuthMessage,
  INVALID_VERIFICATION_CODE_MESSAGE,
  isUnauthorizedNativeRedirectMessage,
  messageForClerkCode,
  UNAUTHORIZED_NATIVE_REDIRECT_MESSAGE,
} from "./clerk-auth-copy.ts"

describe("incompleteAuthMessage needs_client_trust", () => {
  it("does not send users to web-admin trust verification", () => {
    const message = incompleteAuthMessage("sign_in", "needs_client_trust")
    assert.match(message, new RegExp(DEVICE_MUST_BE_VERIFIED_MESSAGE))
    assert.match(message, new RegExp(ENTER_DEVICE_TRUST_CODE_MESSAGE))
    assert.doesNotMatch(message, /web admin/i)
  })

  it("keeps needs_second_factor copy distinct from device trust", () => {
    const message = incompleteAuthMessage("sign_in", "needs_second_factor")
    assert.match(message, /Additional verification/i)
    assert.doesNotMatch(message, /device must be verified/i)
  })
})

describe("verification code copy", () => {
  it("maps form_code_incorrect to invalid verification code", () => {
    assert.equal(messageForClerkCode("form_code_incorrect"), INVALID_VERIFICATION_CODE_MESSAGE)
  })

  it("maps verification_expired to expired verification code", () => {
    assert.equal(messageForClerkCode("verification_expired"), EXPIRED_VERIFICATION_CODE_MESSAGE)
  })
})

describe("extractClerkRetryAfterSeconds", () => {
  it("reads retryAfter from a ClerkAPIResponseError-shaped value", () => {
    const error = Object.assign(new Error("Too many requests"), {
      clerkError: true as const,
      status: 429,
      errors: [{ code: "too_many_requests", message: "Slow down" }],
      retryAfter: 12.4,
    })
    assert.equal(extractClerkRetryAfterSeconds(error), 13)
  })

  it("reads retryAfter from a ClerkError cause", () => {
    const cause = Object.assign(new Error("Too many requests"), {
      clerkError: true as const,
      status: 429,
      errors: [{ code: "too_many_requests", message: "Slow down" }],
      retryAfter: 8,
    })
    const futureError = {
      clerkError: true as const,
      code: "too_many_requests",
      message: "Slow down",
      cause,
    }
    assert.equal(extractClerkRetryAfterSeconds(futureError), 8)
  })

  it("returns null when Clerk did not provide retryAfter", () => {
    const clerkLike = {
      clerkError: true as const,
      code: "form_code_incorrect",
      message: "Incorrect",
    }
    assert.equal(extractClerkRetryAfterSeconds(clerkLike), null)
    assert.equal(extractClerkRetryAfterSeconds(new Error("network")), null)
    assert.equal(extractClerkRetryAfterSeconds(null), null)
  })
})

describe("unauthorized native redirect copy", () => {
  it("detects Clerk redirect allowlist mismatch wording", () => {
    assert.equal(
      isUnauthorizedNativeRedirectMessage(
        "The current redirect url passed in the sign in or sign up request does not match an authorized redirect URI for this instance."
      ),
      true
    )
    assert.equal(isUnauthorizedNativeRedirectMessage("Invalid email or password."), false)
  })

  it("maps redirect_uri_mismatch to the admin allowlist message", () => {
    assert.equal(messageForClerkCode("redirect_uri_mismatch"), UNAUTHORIZED_NATIVE_REDIRECT_MESSAGE)
    assert.match(UNAUTHORIZED_NATIVE_REDIRECT_MESSAGE, /mobile:\/\/sso-callback/)
  })
})
