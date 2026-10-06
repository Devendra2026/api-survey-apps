import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { AUTOSAVE_RETRY_DELAYS_MS, isAutosaveAutoRetryable, nextAutosaveRetryDelayMs } from "./autosave-retry.ts"
import { createPhotoSlotGuard, photoWriteTarget } from "./photo-upload.ts"
import { createSingleFlight } from "./single-flight.ts"

describe("photo retake", () => {
  it("replaces an existing FRONT photo instead of creating another row", () => {
    assert.deepEqual(photoWriteTarget("photo-front"), { mode: "replace", photoId: "photo-front" })
    assert.deepEqual(photoWriteTarget(undefined), { mode: "create" })
  })

  it("allows only one active upload for a photo slot", () => {
    const slots = createPhotoSlotGuard()
    assert.equal(slots.tryAcquire("FRONT"), true)
    assert.equal(slots.tryAcquire("FRONT"), false)
    assert.equal(slots.tryAcquire("SIDE"), true)
    slots.release("FRONT")
    assert.equal(slots.tryAcquire("FRONT"), true)
  })
})

describe("autosave retry", () => {
  it("caps automatic retries", () => {
    const delays = AUTOSAVE_RETRY_DELAYS_MS.map((_, index) => nextAutosaveRetryDelayMs(index))
    assert.deepEqual(delays, [...AUTOSAVE_RETRY_DELAYS_MS])
    assert.equal(nextAutosaveRetryDelayMs(AUTOSAVE_RETRY_DELAYS_MS.length), null)
  })

  it("retries gateway and network failures and waits on 429 and 413", () => {
    assert.equal(isAutosaveAutoRetryable({ kind: "timeout", statusCode: 0 }), true)
    assert.equal(isAutosaveAutoRetryable({ kind: "http", statusCode: 503 }), true)
    assert.equal(isAutosaveAutoRetryable({ kind: "http", statusCode: 429 }), false)
    assert.equal(isAutosaveAutoRetryable({ kind: "http", statusCode: 413 }), false)
    assert.equal(isAutosaveAutoRetryable({ kind: "http", statusCode: 400 }), false)
  })
})

describe("submit single flight", () => {
  it("accepts one submit while another is in progress", () => {
    const flight = createSingleFlight()
    assert.equal(flight.tryBegin(), true)
    let accepted = 0
    for (let index = 0; index < 20; index += 1) {
      if (flight.tryBegin()) accepted += 1
    }
    assert.equal(accepted, 0)
    flight.end()
    assert.equal(flight.tryBegin(), true)
  })
})
