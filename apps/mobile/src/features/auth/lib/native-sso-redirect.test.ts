import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCanonicalNativeSsoRedirectUrl,
  NATIVE_SSO_CALLBACK_PATH,
  NATIVE_SSO_SCHEME_FALLBACK,
  resolveNativeSsoScheme,
} from "./native-sso-redirect-core.ts"

describe("native SSO redirect", () => {
  it("uses the mobile scheme and sso-callback path without a trailing slash", () => {
    assert.equal(NATIVE_SSO_SCHEME_FALLBACK, "mobile")
    assert.equal(NATIVE_SSO_CALLBACK_PATH, "sso-callback")
    assert.equal(buildCanonicalNativeSsoRedirectUrl(), "mobile://sso-callback")
    assert.doesNotMatch(buildCanonicalNativeSsoRedirectUrl(), /\/$/)
  })

  it("prefers an Expo config scheme string when provided", () => {
    assert.equal(resolveNativeSsoScheme("mobile"), "mobile")
    assert.equal(resolveNativeSsoScheme(["mobile", "backup"]), "mobile")
  })

  it("falls back to mobile when Expo scheme is missing", () => {
    assert.equal(resolveNativeSsoScheme(undefined), "mobile")
    assert.equal(resolveNativeSsoScheme(null), "mobile")
    assert.equal(resolveNativeSsoScheme([]), "mobile")
  })
})
