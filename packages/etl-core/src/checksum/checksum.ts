import { createHash } from "node:crypto"

/** Stable SHA-256 of canonical JSON (sorted keys), excluding volatile URL fields. */
export function computeChecksum(value: unknown): string {
  const canonical = canonicalize(value)
  return createHash("sha256").update(canonical).digest("hex")
}

function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(sortKeys)
  const obj = value as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    if (key === "sourceUrl" || key === "url" || key === "objectKey") continue
    sorted[key] = sortKeys(obj[key])
  }
  return sorted
}
