import { createHash, randomBytes } from "node:crypto"

export const ULB_API_KEY_PREFIX = "ulb_live_"
export const ULB_API_KEY_DISPLAY_LENGTH = 16

export type GeneratedUlbApiKey = {
  rawKey: string
  keyHash: string
  keyPrefix: string
}

export function hashUlbApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex")
}

export function ulbApiKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, ULB_API_KEY_DISPLAY_LENGTH)
}

export function generateUlbApiKey(): GeneratedUlbApiKey {
  const rawKey = `${ULB_API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`
  return {
    rawKey,
    keyHash: hashUlbApiKey(rawKey),
    keyPrefix: ulbApiKeyPrefix(rawKey),
  }
}
