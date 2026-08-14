import { describe, expect, it } from "@jest/globals"
import {
  generateUlbApiKey,
  hashUlbApiKey,
  ULB_API_KEY_DISPLAY_LENGTH,
  ULB_API_KEY_PREFIX,
  ulbApiKeyPrefix,
} from "./ulb-api-key.util.js"

describe("ulb-api-key.util", () => {
  it("hashes with SHA-256 hex", () => {
    expect(hashUlbApiKey("test")).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
  })

  it("uses the first 16 characters as the display prefix", () => {
    const raw = "ulb_live_abcdefghijklmnop"
    expect(ulbApiKeyPrefix(raw)).toBe("ulb_live_abcdefg")
    expect(ulbApiKeyPrefix(raw).length).toBe(ULB_API_KEY_DISPLAY_LENGTH)
  })

  it("generates ulb_live_ keys whose hash and prefix match", () => {
    const generated = generateUlbApiKey()
    expect(generated.rawKey.startsWith(ULB_API_KEY_PREFIX)).toBe(true)
    expect(generated.keyPrefix).toBe(generated.rawKey.slice(0, ULB_API_KEY_DISPLAY_LENGTH))
    expect(generated.keyHash).toBe(hashUlbApiKey(generated.rawKey))
    expect(generated.keyHash).toMatch(/^[0-9a-f]{64}$/)
  })
})
