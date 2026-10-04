import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { PIN_DUPLICATE_MESSAGE, pinCodeInputError } from "./pin-code-input.ts"

describe("pinCodeInputError", () => {
  it("returns null for exactly six digits", () => {
    assert.equal(pinCodeInputError("207001"), null)
    assert.equal(pinCodeInputError(" 207001 "), null)
  })

  it("rejects a short value and does not treat it as ready to send", () => {
    assert.equal(pinCodeInputError("12345"), "PIN must be 6 digits")
    assert.equal(pinCodeInputError("2070011"), "PIN must be 6 digits")
    assert.equal(pinCodeInputError("20700a"), "PIN must be 6 digits")
    assert.equal(pinCodeInputError(""), "PIN must be 6 digits")
  })

  it("keeps the server duplicate sentence stable", () => {
    assert.equal(PIN_DUPLICATE_MESSAGE, "This PIN is already registered for the ULB")
  })
})
