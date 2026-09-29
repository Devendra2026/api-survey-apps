import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isCompleteOtpCode, normalizeOtpDigits } from "./otp.ts"

describe("otp helpers", () => {
  it("strips non-digits and caps length", () => {
    assert.equal(normalizeOtpDigits("12-34ab56"), "123456")
    assert.equal(normalizeOtpDigits("99999999"), "999999")
  })

  it("detects complete codes", () => {
    assert.equal(isCompleteOtpCode("123456"), true)
    assert.equal(isCompleteOtpCode("12345"), false)
    assert.equal(isCompleteOtpCode("12 34 56"), true)
  })
})
