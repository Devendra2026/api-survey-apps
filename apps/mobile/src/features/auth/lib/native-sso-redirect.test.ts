import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCanonicalNativeSsoRedirectUrl,
  NATIVE_SSO_CALLBACK_PATH,
  NATIVE_SSO_SCHEME_FALLBACK,
  resolveNativeSsoScheme,
} from "./native-sso-redirect-core.ts"

describe("native SSO redirect", () => {
  it("uses the surveyapp scheme and sso-callback path without a trailing slash", () => {
    assert.equal(NATIVE_SSO_SCHEME_FALLBACK, "surveyapp")
    assert.equal(NATIVE_SSO_CALLBACK_PATH, "sso-callback")
    assert.equal(buildCanonicalNativeSsoRedirectUrl(), "surveyapp://sso-callback")
    assert.doesNotMatch(buildCanonicalNativeSsoRedirectUrl(), /\/$/)
  })

  it("prefers an Expo config scheme string when provided", () => {
    assert.equal(resolveNativeSsoScheme("surveyapp"), "surveyapp")
    assert.equal(resolveNativeSsoScheme(["surveyapp", "backup"]), "surveyapp")
  })

  it("falls back to surveyapp when Expo scheme is missing", () => {
    assert.equal(resolveNativeSsoScheme(undefined), "surveyapp")
    assert.equal(resolveNativeSsoScheme(null), "surveyapp")
    assert.equal(resolveNativeSsoScheme([]), "surveyapp")
  })
})
