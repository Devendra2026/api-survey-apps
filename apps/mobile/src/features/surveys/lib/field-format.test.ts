import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parcelNumberError, phoneError, pinCodeError, unitNumberError } from "./field-format.ts"

describe("field-format", () => {
  it("requires exactly 5 parcel digits", () => {
    assert.equal(parcelNumberError(null), "Type 5 digits.")
    assert.equal(parcelNumberError(""), "Type 5 digits.")
    assert.equal(parcelNumberError("747"), "Type 5 digits.")
    assert.equal(parcelNumberError("1"), "Type 5 digits.")
    assert.equal(parcelNumberError("123456"), "Parcel number cannot be more than 5 digits.")
    assert.equal(parcelNumberError("ABC12"), "Type 5 digits.")
    assert.equal(parcelNumberError("00747"), undefined)
    assert.equal(parcelNumberError("12345"), undefined)
  })

  it("requires exactly 3 unit digits", () => {
    assert.equal(unitNumberError(null), "Type 3 digits.")
    assert.equal(unitNumberError("1"), "Type 3 digits.")
    assert.equal(unitNumberError("01"), "Type 3 digits.")
    assert.equal(unitNumberError("123"), undefined)
    assert.equal(unitNumberError("0001"), "Unit number cannot be more than 3 digits.")
    assert.equal(unitNumberError("001"), undefined)
  })

  it("accepts empty PIN and rejects short/non-digit PIN", () => {
    assert.equal(pinCodeError(null), undefined)
    assert.equal(pinCodeError(""), undefined)
    assert.equal(pinCodeError("123456"), undefined)
    assert.equal(pinCodeError("12345"), "PIN must be 6 digits")
    assert.equal(pinCodeError("12ab56"), "PIN must be 6 digits")
  })

  it("validates phone length after stripping non-digits", () => {
    assert.equal(phoneError(null), undefined)
    assert.equal(phoneError("9876543210"), undefined)
    assert.equal(phoneError("+91 98765 43210"), undefined)
    assert.equal(phoneError("123"), "Enter a valid mobile number")
  })
})
